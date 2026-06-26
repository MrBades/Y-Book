import re
import os
import json
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

def parse_multimodal_smart_input(text=None, image_file=None, audio_file=None):
    """
    Parses digital ledger transaction notes from multimodal input (text, image, audio)
    using gemini-2.5-flash with a structured JSON response schema.
    If the API fails (quota limits, network offline, invalid credentials) or errors,
    it gracefully falls back to a regex-based heuristic parser to ensure stability.
    """
    # 1. Attempt AI Processing if Gemini API is configured
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            client = genai.Client(api_key=api_key)
            
            # Construct the parts
            contents_parts = []
            
            # Base prompt guiding the response structure
            prompt = """
            You are an expert SME accounting AI assistant. Analyze the input transaction 
            (could be a text ledger entry, a voice log transcript, or a visual invoice/receipt image) 
            and extract transaction parameters.
            
            You MUST return a JSON object mapping to the specified schema, containing:
            1. 'product_name': A flat single string of the main product or aggregated products (e.g. 'Garri' or 'Garri, Sugar').
            2. 'items': A list of objects, each with 'name', 'quantity' (integer), 'price' (decimal/float), and 'total' (decimal/float).
            3. 'customer_name': The name of the buyer/customer. If not mentioned, use 'Walk-in Customer'.
            4. 'total_amount': The grand sum of the transaction.
            5. 'amount_paid': The deposit or immediate amount paid by the customer. Defaults to 0 if not stated.
            6. 'debt_balance': The remaining unpaid balance (total_amount - amount_paid).
            7. 'transaction_type': Either 'sale' or 'expense' or 'payment_on_account'.
            """
            contents_parts.append(prompt)
            
            if text:
                contents_parts.append(f"Text Input:\n{text}")
            
            if image_file:
                # Assuming image_file is a Django UploadedFile or file-like object
                image_data = image_file.read()
                # Reset file pointer for fallback safety
                image_file.seek(0)
                
                # Retrieve mime-type from uploaded file if available, or default
                mime_type = getattr(image_file, 'content_type', 'image/jpeg')
                
                contents_parts.append(
                    types.Part.from_bytes(
                        data=image_data,
                        mime_type=mime_type
                    )
                )
                
            if audio_file:
                # Assuming audio_file is a Django UploadedFile or file-like object
                audio_data = audio_file.read()
                # Reset file pointer for fallback safety
                audio_file.seek(0)
                
                mime_type = getattr(audio_file, 'content_type', 'audio/webm')
                contents_parts.append(
                    types.Part.from_bytes(
                        data=audio_data,
                        mime_type=mime_type
                    )
                )

            # Let's specify the strict JSON schema for stable parsing
            schema = types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "product_name": types.Schema(type=types.Type.STRING, description="Flat key of main product name(s)"),
                    "customer_name": types.Schema(type=types.Type.STRING, description="Name of buying customer or 'Walk-in Customer'"),
                    "items": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "name": types.Schema(type=types.Type.STRING),
                                "quantity": types.Schema(type=types.Type.INTEGER),
                                "price": types.Schema(type=types.Type.NUMBER),
                                "total": types.Schema(type=types.Type.NUMBER),
                            },
                        ),
                    ),
                    "total_amount": types.Schema(type=types.Type.NUMBER),
                    "amount_paid": types.Schema(type=types.Type.NUMBER),
                    "debt_balance": types.Schema(type=types.Type.NUMBER),
                    "transaction_type": types.Schema(type=types.Type.STRING),
                },
                required=["product_name", "customer_name", "items", "total_amount", "amount_paid", "debt_balance"]
            )

            # API Call using the modern python client
            # Note: custom configuration can be passed via config parameters
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents_parts,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.1
                )
            )
            
            if response.text:
                parsed_data = json.loads(response.text.strip())
                # Ensure the core database flat field requirement is met
                if 'product_name' not in parsed_data or not parsed_data['product_name']:
                    if parsed_data.get('items'):
                        parsed_data['product_name'] = ", ".join([itm.get('name', 'Item') for itm in parsed_data['items']])
                    else:
                        parsed_data['product_name'] = "General Goods"
                        
                return parsed_data

        except Exception as e:
            logger.error(f"Gemini processing failed: {str(e)}. Attempting heuristic/manual fallback.")

    # 2. Heuristic Manual Fallback Parser (Robust Local Extraction via Regex)
    return run_local_fallback_parser(text)


def parse_amount(value_str, multiplier_str):
    """Helper to convert values like '45k' or '1.5 million' into floats."""
    if not value_str:
        return 0.0
    # Strip commas before parsing
    try:
        value = float(value_str.replace(',', ''))
    except ValueError:
        return 0.0
    
    if multiplier_str:
        m = multiplier_str.lower()
        if m in ['k', 'kilo', 'thousand']:
            value *= 1000
        elif m in ['m', 'million']:
            value *= 1000000
        elif m in ['b', 'billion']:
            value *= 1000000000
            
    return value

def run_local_fallback_parser(text):
    """
    Local heuristic parsing using regex to extract purchase, customer, and debt information.
    Ensures that a stable dictionary containing all expected keys is ALWAYS returned.
    """
    if not text:
        text = ""

    # Defaults to prevent KeyError crashes in views or template rendering
    invoice_data = {
        "product_name": "General Goods",
        "customer_name": "Walk-in Customer",
        "items": [],
        "total_amount": 0.0,
        "amount_paid": 0.0,
        "debt_balance": 0.0,
        "transaction_type": "sale"
    }

    try:
        raw_text = text.strip()
        
        # 1. Parsing Customer Name (e.g. "to Emeka", "to John", "for Chinedu")
        # Added support for spaces in customer names
        customer_match = re.search(r'(?:to|for|buyer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*|[a-zA-Z]+)', raw_text, re.IGNORECASE)
        if customer_match:
            invoice_data["customer_name"] = customer_match.group(1).strip()

        # Improved Amount Regex
        # Matches formats like: 100, 100.50, 1,000, 45k, 1.5 million, 20 m
        AMOUNT_REGEX = r'([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?'

        # 2. Parsing amount paid (deposit or payment)
        paid_match = re.search(r'(?:paid|deposit|payment.*?of|paid.*?deposit)\s*(?:N|₦)?\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
        
        if paid_match:
            invoice_data["amount_paid"] = parse_amount(paid_match.group(1), paid_match.group(2))

        # 3. Parsing quantity, item name, and price each
        # Match: "3 bags of Garri for 45k each", "10 shirts at 5000", "5 Garri 20000"
        # Item regex: (\d+)?\s*(?:bags|units|pieces)?\s*of?\s*([\w\s]+?)\s*(?:for|at|each)?\s*(?:N|₦)?\s*AMOUNT_REGEX
        item_match = re.search(r'(\d+)?\s*(?:bags|units|pieces|kg)?\s*of?\s*([\w\s]+?)\s*(?:for|at|each)?\s*(?:N|₦)?\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
        
        qty = 1
        price_per_unit = 0.0
        prod_name = "General Goods"

        if item_match:
            qty = int(item_match.group(1)) if item_match.group(1) else 1
            prod_name = item_match.group(2).strip()
            # Clean up potential noise inside product name
            prod_name = re.sub(r'\b(bags|items|pieces|cartons|of|kg)\b', '', prod_name, flags=re.IGNORECASE).strip()
            
            price_per_unit = parse_amount(item_match.group(3), item_match.group(4))
        else:
            # Simple fallback search for any visible numbers representing a lump sum
            lump_sum_match = re.search(r'(?:for|amounting to|total|worth)\s*(?:N|₦)?\s*' + AMOUNT_REGEX, raw_text, re.IGNORECASE)
            if lump_sum_match:
                price_per_unit = parse_amount(lump_sum_match.group(1), lump_sum_match.group(2))
                qty = 1
                
                # Try to extract the product name (e.g. "Sold 3 bags of Garri", "sold garri")
                prod_extract = re.search(r'(?:sold|bought|sale of)\s+(?:\d+\s+)?(?:bags of|cartons of|pieces of\s+)?([\w\s]+?)\s+(?:to|for|at)', raw_text, re.IGNORECASE)
                if prod_extract:
                    prod_name = prod_extract.group(1).strip()

        # Normalize product name
        if prod_name:
            invoice_data["product_name"] = prod_name

        total_amount = qty * price_per_unit
        invoice_data["total_amount"] = total_amount
        
        # Build standard items array
        invoice_data["items"] = [
            {
                "name": prod_name,
                "quantity": qty,
                "price": price_per_unit,
                "total": total_amount
            }
        ]

        # Calculate debt safely
        debt = max(0.0, total_amount - invoice_data["amount_paid"])
        invoice_data["debt_balance"] = debt
        
        if debt > 0:
            invoice_data["transaction_type"] = "sale"
            
    except Exception as parse_err:
        logger.error(f"Regex parsing exception: {str(parse_err)}")
        # Ultimate fail safe to ensure view always runs
        invoice_data["items"] = [
            {
                "name": invoice_data["product_name"],
                "quantity": 1,
                "price": 0.0,
                "total": 0.0
            }
        ]

    return invoice_data

