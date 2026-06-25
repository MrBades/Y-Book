import { useState, useRef, FormEvent, ChangeEvent, useEffect } from 'react';
import { 
  Mic, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  X, 
  Trash2, 
  Volume2,
  FileText,
  Calculator,
  User,
  ShoppingBag,
  CircleDollarSign
} from 'lucide-react';
import { InvoiceItem } from '../types';
import { apiFetch } from '../lib/api';

interface SmartWidgetProps {
  isService?: boolean;
  isInvoice?: boolean;
  subscriptionPlan?: string;
  onUpgradeClick?: () => void;
  onSaveParsedInvoice: (parsedInvoice: {
    customerName: string;
    productName: string;
    items: InvoiceItem[];
    totalAmount: number;
    amountPaid: number;
    debtBalance: number;
    transactionType: 'sale' | 'expense' | 'payment_on_account';
  }) => void;
}

export default function SmartWidget({ 
  onSaveParsedInvoice, 
  isService = false, 
  isInvoice = false,
  subscriptionPlan,
  onUpgradeClick
}: SmartWidgetProps) {
  const getPlanTier = (planName?: string): number => {
    if (!planName) return 1;
    const name = planName.toLowerCase();
    if (name.includes('enterprise')) return 4;
    if (name.includes('pro') || name.includes('starter pro') || name.includes('starter') || name.includes('premium')) return 3;
    if (name.includes('growth')) return 2;
    return 1; // SME Basic / Free
  };

  const isAIAllowed = getPlanTier(subscriptionPlan) >= 2;

  // Tabs: 'online_or_ai', 'parser_or_offline', 'manual'
  const [activeTab, setActiveTab] = useState<'online_or_ai' | 'parser_or_offline' | 'manual'>(() => {
    const tier = getPlanTier(subscriptionPlan);
    return tier >= 2 ? 'online_or_ai' : 'manual';
  });
  
  const [text, setText] = useState('');
  
  const QUICK_ACTIONS = [
    { id: 'add_voice', label: '🗣️ Add voice note', text: "Record a voice note command detailing a ₦45,000 cash deposit from Baba." },
    { id: 'improve', label: '📈 Improve tracking', text: "Introduce premium debtor logs by calculating the cumulative credit balance due." },
    { id: 'extract', label: '🧾 Extract receipt details', text: "Scan and structure the transaction details from my snapped merchant retail invoice." },
    { id: 'ledger', label: '🏢 General ledger entry', text: "Create general ledger record: Sold 3 bags of Garri to Emeka for 45k each, he deposited 100k cash." },
  ].filter(action => {
    if (isService && action.id === 'ledger') return false;
    return true;
  });
  
  const [imageQueue, setImageQueue] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVoiceBlob, setRecordedVoiceBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const handleLocalParse = () => {
    setIsLoading(true);
    
    const parseAmountLocal = (valStr: string, multStr: string | undefined): number => {
      if (!valStr) return 0.0;
      const val = parseFloat(valStr.replace(/,/g, ''));
      if (isNaN(val)) return 0.0;
      if (multStr) {
        const m = multStr.toLowerCase();
        if (['k', 'kilo', 'thousand'].includes(m)) return val * 1000;
        if (['m', 'million'].includes(m)) return val * 1000000;
      }
      return val;
    };

    const rawText = text.trim();
    
    // 1. Transaction Type
    let transactionType: 'sale' | 'expense' | 'payment_on_account' = 'sale';
    if (/\b(expense|spent|bought|purchase|cost|paid for|payment for)\b/i.test(rawText)) {
      transactionType = 'expense';
    } else if (/\b(payment on account|deposit on account)\b/i.test(rawText)) {
      transactionType = 'payment_on_account';
    }

    // Modern Line-by-Line Multi-Entry Parser
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedItems: InvoiceItem[] = [];
    let extractedCustomer = 'Walk-in Customer';
    let amountPaidSum = 0.0;

    // Check customer names in lines
    for (const line of lines) {
      const custFormMatch = line.match(/^(?:customer|buyer|client|seller|to|for|from|sold to|for customer)\s*:\s*([a-zA-Z\s]+)/i) ||
                            line.match(/^(?:sold\s+to|bought\s+from|received\s+from)\s+([a-zA-Z\s]+)$/i);
      if (custFormMatch) {
        const nameCandidate = custFormMatch[1].trim();
        if (nameCandidate && !/^(bags|units|pieces|kg|items|cash|the|each)$/i.test(nameCandidate)) {
          extractedCustomer = nameCandidate;
          continue;
        }
      }

      // Check payments in lines
      const paymentMatch = line.match(/^(?:paid|pay|deposit|deposited|payment|cash|received|got|amt paid|amount paid)\s*(?:of|cash)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million)?/i) ||
                           line.match(/^(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million)?\s*(?:paid|pay|deposited?|payment|cash|received|got)/i);
      if (paymentMatch) {
        amountPaidSum += parseAmountLocal(paymentMatch[1], paymentMatch[2]);
        continue;
      }

      // Check item / commodity in lines
      // Matches "5 bags of rice at 75000", "2 bags of rice at 75000" etc.
      const itemRegex = /^\s*(?:sold|bought|sale of|purchase of)?\s*(?:(\d+)\s*(?:bags|units|pieces|pcs|kg|cartons|items|shirts|pairs|bottles|carton|bag|pair|bottle|packet|packets|pc|box|boxes)?\s*(?:of)?\s+)?([a-zA-Z0-9\s_\-]+?)(?:\s+(?:at|for|each|@|₦|N|N\s*|₦\s*)\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million)?(?:\s*each|each|unit|per unit)?)?$/i;
      const itemMatch = line.match(itemRegex);
      if (itemMatch) {
        const qtyStr = itemMatch[1];
        let prodNameStr = itemMatch[2].trim();
        const priceStr = itemMatch[3];
        const multStr = itemMatch[4];

        const lineQty = qtyStr ? parseInt(qtyStr, 10) : 1;
        
        if (prodNameStr) {
          prodNameStr = prodNameStr.replace(/\b(bags|units|pieces|cartons|of|kg|items|pcs)\b/gi, '').trim();
        }

        // Avoid false positives on action tokens
        if (prodNameStr && !/^(paid|deposit|deposited|payment|cash|received|got|to|for|from|customer|buyer|client|seller|at|each)$/i.test(prodNameStr)) {
          let lineUnitPrice = 0.0;
          if (priceStr) {
            lineUnitPrice = parseAmountLocal(priceStr, multStr);
          }
          const lineTotal = lineQty * lineUnitPrice;
          
          parsedItems.push({
            name: prodNameStr,
            quantity: lineQty,
            price: lineUnitPrice,
            total: lineTotal
          });
        }
      }
    }

    if (parsedItems.length > 0) {
      if (extractedCustomer === 'Walk-in Customer') {
        const customerMatch = rawText.match(/(?:to|for|from|buyer|customer|seller)\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|each|deposit|deposited|pay|paid|with|got|received|he|she|on|₦|N|\d+|,|;|\.|\blet\b|$))/i);
        if (customerMatch) {
          const name = customerMatch[1].trim();
          if (name && !/^(bags|units|pieces|kg|items|cash|the)$/i.test(name)) {
            extractedCustomer = name;
          }
        }
      }

      const totalAmountVal = parsedItems.reduce((acc, itm) => acc + (itm.total || 0), 0);
      const unifiedProdName = parsedItems.map(itm => itm.name).join(', ') || 'General Commodity';

      setTimeout(() => {
        setOutcome({
          status: 'fallback_error',
          parsed_data: {
            product_name: unifiedProdName,
            customer_name: extractedCustomer,
            items: parsedItems,
            total_amount: totalAmountVal,
            amount_paid: amountPaidSum,
            debt_balance: Math.max(0, totalAmountVal - amountPaidSum),
            transaction_type: transactionType
          },
          fallback_message: `Local line parser extracted ${parsedItems.length} items. Total: ₦${totalAmountVal.toLocaleString(undefined, {minimumFractionDigits: 2})}, Paid: ₦${amountPaidSum.toLocaleString(undefined, {minimumFractionDigits: 2})}`
        });
        setIsLoading(false);
      }, 500);
      return;
    }

    // 2. Extract customer name
    let customer = 'Walk-in Customer';
    const customerMatch = rawText.match(/(?:to|for|from|buyer|customer|seller)\s+([a-zA-Z\s]+?)(?:\s+(?:for|at|each|deposit|deposited|pay|paid|with|got|received|he|she|on|₦|N|\d+|,|;|\.|\blet\b|$))/i);
    if (customerMatch) {
      const name = customerMatch[1].trim();
      if (name && !/^(bags|units|pieces|kg|items|cash|the)$/i.test(name)) {
        customer = name;
      }
    }

    // 3. Extract amount paid / deposit
    let amountPaid = 0.0;
    const paidMatch = rawText.match(/(?:deposit(?:ed|s|ing)?|paid|pay(?:ing|s)?|got|received?|payment\s*(?:of)?)\s*(?:cash\s+)?(?:of|cash)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i) || 
                      rawText.match(/(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*(?:cash\s+)?(?:deposit|deposited|paid|payment|received|got)/i);
    if (paidMatch) {
      amountPaid = parseAmountLocal(paidMatch[1], paidMatch[2]);
    }

    // 4. Extract quantity, item name
    let qty = 1;
    let prodName = 'General Commodity';

    const qtyItemRegex = /\b(\d+)\s*(?:bags|units|pieces|pcs|kg|cartons|items|shirts|pairs|bottles)?\s*(?:of)?\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i;
    const qtyItemMatch = rawText.match(qtyItemRegex);
    if (qtyItemMatch) {
      qty = parseInt(qtyItemMatch[1], 10);
      prodName = qtyItemMatch[2].trim();
    } else {
      const itemExtract = rawText.match(/(?:sold|bought|sale of|purchase of)\s+([a-zA-Z\s]+?)(?:\s+(?:to|for|at|each|with|and|he|she|deposited|paid|deposit|₦|N|\d+|,|;|\.|$))/i);
      if (itemExtract) {
        prodName = itemExtract[1].trim();
      }
    }

    if (!prodName || prodName === 'General Commodity') {
      const startingWordMatch = rawText.match(/^([a-zA-Z]{2,15})(?:\s+(?:₦|N|\d+|for|to|at|each|with|and|he|she|deposited|paid|deposit))/i);
      if (startingWordMatch && !/^(create|record|add|new|sold|bought|sale|expense)$/i.test(startingWordMatch[1])) {
        prodName = startingWordMatch[1].trim();
      }
    }

    if (prodName) {
      prodName = prodName.replace(/\b(bags|units|pieces|cartons|of|kg|items|pcs)\b/gi, '').trim();
    }

    // 5. Extract unit price or total price
    const eachMatch = rawText.match(/(?:for|at|@)?\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\s*each/i) || 
                      rawText.match(/(?:at|@)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);

    let pricePerUnit = 0.0;
    let isUnitPriceFound = false;

    if (eachMatch) {
      pricePerUnit = parseAmountLocal(eachMatch[1], eachMatch[2]);
      isUnitPriceFound = true;
    }

    let totalAmount = 0.0;
    if (isUnitPriceFound) {
      totalAmount = qty * pricePerUnit;
    } else {
      const lumpSumMatch = rawText.match(/(?:for|amounting\s+to|totalling|worth|total\s*(?:of)?)\s*(?:N|₦)?\s*([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?/i);
      if (lumpSumMatch) {
        totalAmount = parseAmountLocal(lumpSumMatch[1], lumpSumMatch[2]);
        pricePerUnit = totalAmount / qty;
      } else {
        const numbersMatch = [...rawText.matchAll(/\b([\d,]+(?:\.\d+)?)\s*(k|kilo|thousand|m|million|b|billion)?\b/gi)];
        const candidatePrices: number[] = [];
        numbersMatch.forEach(m => {
          const val = parseAmountLocal(m[1], m[2]);
          if (val !== qty && val !== amountPaid) {
            candidatePrices.push(val);
          }
        });

        if (candidatePrices.length > 0) {
          const candidate = candidatePrices[0];
          if (qty > 1 && candidate < 50000) {
            pricePerUnit = candidate;
            totalAmount = qty * pricePerUnit;
          } else {
            totalAmount = candidate;
            pricePerUnit = totalAmount / qty;
          }
        }
      }
    }

    if (totalAmount === 0 && pricePerUnit > 0) {
      totalAmount = qty * pricePerUnit;
    }
    if (pricePerUnit === 0 && totalAmount > 0) {
      pricePerUnit = totalAmount / qty;
    }

    setTimeout(() => {
      setOutcome({
        status: 'fallback_error',
        parsed_data: {
          product_name: prodName || 'General Commodity',
          customer_name: customer,
          items: [{ 
            name: prodName || 'General Commodity', 
            quantity: qty, 
            price: pricePerUnit, 
            total: totalAmount 
          }],
          total_amount: totalAmount,
          amount_paid: amountPaid,
          debt_balance: Math.max(0, totalAmount - amountPaid),
          transaction_type: transactionType
        },
        fallback_message: `Detected Parsing: Total ${totalAmount}, Paid ${amountPaid}, Customer ${customer}, Item ${prodName || 'N/A'}`
      });
      setIsLoading(false);
    }, 500);
  };

  // Manual input form states embedded directly in the widget!
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [manualAmountPaid, setManualAmountPaid] = useState('');

  const [outcome, setOutcome] = useState<{
    status: string;
    parsed_data: {
      product_name: string;
      customer_name: string;
      items: InvoiceItem[];
      total_amount: number;
      amount_paid: number;
      debt_balance: number;
      transaction_type: 'sale' | 'expense' | 'payment_on_account';
    };
    fallback_message?: string;
  } | null>(null);

  // Editable fields for parsed/manually generated data
  const [editCustomer, setEditCustomer] = useState('');
  const [editType, setEditType] = useState<'sale' | 'expense' | 'payment_on_account'>('sale');
  const [editTotal, setEditTotal] = useState('0');
  const [editPaid, setEditPaid] = useState('0');
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (outcome && outcome.parsed_data) {
      setEditCustomer(outcome.parsed_data.customer_name || '');
      setEditType(outcome.parsed_data.transaction_type || 'sale');
      setEditTotal((outcome.parsed_data.total_amount || 0).toString());
      setEditPaid((outcome.parsed_data.amount_paid || 0).toString());
      setEditItems(outcome.parsed_data.items || []);
    }
  }, [outcome]);

  const handleEditItemChange = (index: number, key: keyof InvoiceItem, value: any) => {
    setEditItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [key]: value,
        total: key === 'quantity' || key === 'price'
          ? (key === 'quantity' ? Number(value) : copy[index].quantity) * 
            (key === 'price' ? Number(value) : copy[index].price)
          : copy[index].total
      };
      
      // Also automatically recompute the overall total
      const newTotal = copy.reduce((sum, item) => sum + (item.total || 0), 0);
      setEditTotal(newTotal.toString());
      
      return copy;
    });
  };

  const handleDeleteEditItem = (index: number) => {
    setEditItems((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      const newTotal = copy.reduce((sum, item) => sum + (item.total || 0), 0);
      setEditTotal(newTotal.toString());
      return copy;
    });
  };

  const handleAddEditItem = () => {
    setEditItems((prev) => [
      ...prev,
      { name: 'New Item', quantity: 1, price: 0, total: 0 }
    ]);
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setActiveTab('manual'); // Slides over to Manual tab immediately!
    };

    // Update initial state
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setActiveTab('manual');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helpers: File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error("File conversion failed"));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Browser Audio recording API setup
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedVoiceBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: any) {
      alert("Microphone capture disabled or blocked: " + err.message);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleRemoveVoice = () => {
    setRecordedVoiceBlob(null);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  };

  // File Upload Queue handlers
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = selectedFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file as any)
      }));
      setImageQueue((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageQueue((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleResetAll = () => {
    setText('');
    handleRemoveVoice();
    imageQueue.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImageQueue([]);
    setOutcome(null);
  };

  const handleActionPillClick = (pillText: string) => {
    setText(pillText);
    setActiveTab('online_or_ai');
    setOutcome(null); // Clear previous output to write new text description
  };

  // Dispatch unified payload asynchronously
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text && imageQueue.length === 0 && !recordedVoiceBlob) {
      alert("No prompt, voice, or image assets captured yet.");
      return;
    }

    if (activeTab === 'parser_or_offline') {
      handleLocalParse();
      return;
    }

    setIsLoading(true);
    setOutcome(null);
    setError(null);

    try {
      let filePayload: { data: string; mimeType: string } | null = null;

      // Extract high priority files for the single REST payload
      if (imageQueue.length > 0) {
        const firstImg = imageQueue[0].file;
        const base64 = await fileToBase64(firstImg);
        filePayload = {
          data: base64,
          mimeType: firstImg.type
        };
      } else if (recordedVoiceBlob) {
        const audioFile = new File([recordedVoiceBlob], "voice.webm", { type: 'audio/webm' });
        const base64 = await fileToBase64(audioFile);
        filePayload = {
          data: base64,
          mimeType: 'audio/webm'
        };
      }

      console.log("Preparing to dispatch to /api/smart-input...");
      const res = await apiFetch('/api/smart-input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': localStorage.getItem('session_id') || '',
          'x-device-fingerprint': localStorage.getItem('device_fingerprint') || ''
        },
        body: JSON.stringify({
          text,
          file: filePayload
        })
      });
      console.log("Response received from /api/smart-input. Status:", res.status);

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error(`Server returned non-JSON response (status: ${res.status}): ${text.substring(0, 100)}...`);
      }

      const data = await res.json();
      if (res.ok) {
        setOutcome(data);
      } else {
        setError("Extraction service error: " + (data.error || "Unknown response state"));
      }

    } catch (err: any) {
      console.error(err);
      setError("Multimodal pipeline connection failure: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommitToLedger = () => {
    if (outcome) {
      const parsedAmtTotal = parseFloat(editTotal) || 0;
      const parsedAmtPaid = parseFloat(editPaid) || 0;
      const computedParsedDebt = Math.max(0, parsedAmtTotal - parsedAmtPaid);

      onSaveParsedInvoice({
        customerName: editCustomer || "Walk-in Customer",
        productName: editItems.length > 0 ? editItems[0].name : "General Commodity",
        items: editItems,
        totalAmount: parsedAmtTotal,
        amountPaid: parsedAmtPaid,
        debtBalance: computedParsedDebt,
        transactionType: editType
      });
      handleResetAll();
      alert("Validated transaction committed to direct Ledger!");
    }
  };

  const handleManualFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    const qty = parseInt(manualQty, 10) || 1;
    const price = parseFloat(manualUnitPrice) || 0;
    const paid = parseFloat(manualAmountPaid) || 0;
    const total = qty * price;
    const debt = Math.max(0, total - paid);

    onSaveParsedInvoice({
      customerName: manualCustomer || "Walk-in Customer",
      productName: manualProductName || "General Commodity",
      items: [{
        name: manualProductName || "General Commodity",
        quantity: qty,
        price: price,
        total: total
      }],
      totalAmount: total,
      amountPaid: paid,
      debtBalance: debt,
      transactionType: 'sale'
    });

    // Reset manual form inputs
    setManualCustomer('');
    setManualProductName('');
    setManualQty('1');
    setManualUnitPrice('');
    setManualAmountPaid('');

    alert("Standard record saved successfully to the client ledger!");
  };

  return (
    <div className="bg-white rounded-[24px] shadow-md overflow-hidden flex flex-col transition-all duration-300 w-full" id="smart-widget">
      {/* 1. Clear, Modern Switcher Header */}
      <div className="bg-[#0E1338] px-4.5 py-3 flex items-center justify-between gap-4 text-white border-b border-white/10">
        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl border border-white/5 shadow-inner" id="smart-widget-header-tabs">
          <button
            type="button"
            onClick={() => isOnline && setActiveTab('online_or_ai')}
            disabled={!isOnline}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              !isOnline 
                ? 'bg-white/5 text-white/40 cursor-not-allowed opacity-40' 
                : activeTab === 'online_or_ai'
                  ? 'bg-[#00A6FF] text-white shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>✨ AI</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parser_or_offline')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'parser_or_offline'
                ? 'bg-[#00A6FF] text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📄 fuse</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'manual' 
                ? 'bg-[#00A6FF] text-white shadow-sm' 
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📝 Manual</span>
          </button>
        </div>

        <div className="flex items-center bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg" title="Active">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
      </div>

      <div className="p-6">
        {/* Helper Online/Offline Diagnostic Alert */}
        {!isOnline && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-center gap-2.5 text-xs animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>Device Offline Protection:</strong> Multimodal Voice and Snapshot extraction is temporarily disabled. Active input has been locked to the classic manual structured form backup.</span>
          </div>
        )}

        {/* Dynamic Error Alert */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 flex items-center justify-between gap-2.5 text-xs animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">
               <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. Ribbon of quick-action capsule tags */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3.5 mb-5 border-b border-gray-100 scrollbar-thin max-w-full" id="smart-widget-action-ribbon">
          {isOnline ? (
            QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => handleActionPillClick(action.text)}
                className="px-3.5 py-1.5 bg-gray-50 hover:bg-[#00A6FF]/10 hover:text-[#0E1338] hover:border-[#00A6FF]/20 text-[#4A5568] border border-gray-150 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer"
              >
                {action.label}
              </button>
            ))
          ) : (
            <span className="text-[11px] font-bold text-gray-400 font-mono">🔧 Offline Heuristics Active</span>
          )}
        </div>

        {/* 3. Render Active Workspace View */}
        {(activeTab === 'online_or_ai' || activeTab === 'parser_or_offline') ? (
          (!isAIAllowed && activeTab === 'online_or_ai') ? (
            <div className="text-center py-10 px-4 space-y-4 border border-blue-150 rounded-2xl bg-slate-50 relative overflow-hidden">
              <div className="absolute right-0 top-0 opacity-5 transform translate-x-6 -translate-y-6 pointer-events-none select-none">
                <Sparkles className="w-48 h-48 text-[#00A6FF]" />
              </div>
              <div className="w-12 h-12 bg-blue-50 text-[#00A6FF] rounded-full flex items-center justify-center mx-auto shadow-sm">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-800 text-sm">✨ Premium AI Invoice Bookkeeper</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Natural language bookkeeping, multi-item voice note parsing, and automatic receipt extraction are exclusive features for <strong>Growth</strong>, <strong>Starter Pro</strong>, and <strong>Enterprise</strong> tiers.
                </p>
              </div>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="inline-flex items-center gap-1.5 px-4 h-9 bg-gradient-to-r from-[#00A6FF] to-blue-600 font-bold text-xs text-white rounded-xl shadow-md hover:brightness-110 transition"
              >
                Upgrade to Growth Plan
              </button>
            </div>
          ) : (
            <div>
            {outcome ? (
              /* Inline Preview Results dashboard representation if outcome generated! */
              <div className="space-y-4 border border-gray-150 rounded-2xl p-5 bg-white shadow-inner animate-fadeIn">
                <div className="flex items-center justify-between border-b pb-3 border-gray-150">
                  <h3 className="text-xs font-extrabold text-[#0E1338] uppercase tracking-wider">Bookkeeping Parameter Dashboard</h3>
                  <div className="flex items-center gap-1.5">
                    {outcome.status === 'fallback_error' ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-250">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-bounce" /> Offline Parser Triggered
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> AI Verified Entry
                      </span>
                    )}
                  </div>
                </div>

                {outcome.fallback_message && (
                  <p className="text-xs text-amber-750 bg-amber-50 p-3 rounded-xl border border-amber-150 leading-relaxed font-mono">
                    {outcome.fallback_message}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wide">Customer (Client)</span>
                    <p className="text-sm font-extrabold text-gray-800 mt-1">{outcome.parsed_data.customer_name || 'Walk-in Customer'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wide">Billing Type</span>
                    <p className="text-sm font-extrabold text-[#0E1338] capitalize mt-1">{outcome.parsed_data.transaction_type || 'sale'}</p>
                  </div>
                </div>

                {/* Line Items extracted */}
                <div className="border-t border-b border-gray-100 py-3 my-2 space-y-2">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block tracking-wide">Extracted Commodities</span>
                  {outcome.parsed_data.items && outcome.parsed_data.items.length > 0 ? (
                    <div className="space-y-1.5 font-mono text-xs">
                      {outcome.parsed_data.items.map((itm, i) => (
                        <div key={i} className="flex justify-between text-gray-600 text-[11px]">
                          <span>• {itm.name} (x{itm.quantity})</span>
                          <span className="font-semibold text-gray-800">₦{(itm.price || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">No specific lines structured. Overall standard mapping applied.</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Total Invoice</span>
                    <span className="text-gray-800 font-extrabold text-xs">₦{(outcome.parsed_data.total_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Total Deposit</span>
                    <span className="text-emerald-700 font-extrabold text-xs">₦{(outcome.parsed_data.amount_paid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-[10px] uppercase font-semibold block">Credit Balance</span>
                    <span className={`text-xs font-extrabold ${outcome.parsed_data.debt_balance > 0 ? 'text-[#D32F2F]' : 'text-emerald-600'}`}>
                      ₦{(outcome.parsed_data.debt_balance || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleResetAll}
                    className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-650 font-bold hover:bg-gray-50 transition text-xs text-center"
                  >
                    Wipe & New Input
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitToLedger}
                    className="py-2.5 px-4 bg-[#0E1338] hover:bg-[#00A6FF] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Save Ledger
                  </button>
                </div>
              </div>
            ) : (
              /* Normal Entry Text Input Workspace Panel Container */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative bg-gray-50/50 backdrop-blur-sm rounded-[24px] border border-gray-200 p-4 focus-within:ring-2 focus-within:ring-[#00A6FF] focus-within:border-transparent transition-all">
                  
                  {/* Text Input Workspace Area */}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      isService 
                        ? "Describe the service transaction...\ne.g. 'To Alao: 5 hours of Web Design at 15000 each, deposit paid 50000'\nOr '3 sessions of consulting for John at 25000 each'"
                        : "Describe the trade or invoice details here...\ne.g. 'Sold to Baba: 15 bags of cement at 8500 each, paid 100k'\nOr '6 sacks of flour to Alao for 32000 each, paid 120000 Naira'\nOr list line by line:\n'customer: Ada\n2 bags of rice at 75000\n3 bags of flour at 32000\npaid 150000'"
                    }
                    rows={6}
                    className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm font-sans placeholder:text-gray-400 text-gray-800 resize-none pb-20 pr-2 scrollbar-thin leading-relaxed"
                    id="unified-multimodal-input"
                  />

                  {/* Asset Upload & Voice Queue Elements nested in the input card itself */}
                  {(imageQueue.length > 0 || recordedVoiceBlob) && (
                    <div className="absolute bottom-20 left-4 flex flex-wrap gap-2 items-center z-10 max-w-[70%] bg-white/95 border border-gray-150 p-1.5 rounded-xl shadow-sm animate-fadeIn">
                      {imageQueue.map((img, id) => (
                        <div key={id} className="relative group w-11 h-11 rounded-lg overflow-hidden border border-gray-200">
                          <img src={img.previewUrl} alt="Snapped receipt item" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(id)}
                            className="absolute inset-0 bg-[#D32F2F]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                            title="Delete snapshot snippet"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {recordedVoiceBlob && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00A6FF]/10 text-[#0E1338] border border-[#00A6FF]/25 rounded-lg text-[10px] font-bold">
                          <Volume2 className="w-3.5 h-3.5 text-[#00A6FF] animate-pulse" />
                          <span>Voice Note ({recordingDuration}s)</span>
                          <button
                            type="button"
                            onClick={handleRemoveVoice}
                            className="text-gray-400 hover:text-red-600 transition ml-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BOTTOM UTILITY TRAY (CONTAINS ONLY Microphones & Plus uploading - NO right Arrow) */}
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/95 border border-gray-150 p-1.5 rounded-2xl shadow-sm z-10">
                    {/* Voice Capture microphone */}
                    <button
                      type="button"
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={`p-2 rounded-xl transition cursor-pointer relative ${
                        isRecording 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : recordedVoiceBlob 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' 
                            : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                      }`}
                      title={isRecording ? "Stop Recording" : "Record Voice Command"}
                    >
                      <Mic className="w-4.5 h-4.5" />
                    </button>

                    {/* Snapshot / Image uploading */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`p-2 rounded-xl border border-transparent transition cursor-pointer ${
                        imageQueue.length > 0 
                          ? 'bg-blue-50 text-blue-600 border-blue-150' 
                          : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'
                      }`}
                      title="Attach Snap of handwritten ledger page"
                    >
                      <Plus className="w-4.5 h-4.5" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                      multiple
                    />

                    {/* Trash wipe reset */}
                    <button
                      type="button"
                      onClick={handleResetAll}
                      disabled={text === '' && imageQueue.length === 0 && !recordedVoiceBlob}
                      className="p-2 hover:bg-gray-100 text-gray-300 hover:text-gray-600 rounded-xl transition cursor-pointer disabled:opacity-25"
                      title="Clear active workspace input"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>

                {/* Direct Transaction Format Templates Quick-Inject system */}
                <div className="bg-[#F4F9FF] rounded-[18px] p-3.5 border border-[#00A6FF]/10 space-y-2 mt-2 leading-tight">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#0E1338] flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-[#00A6FF]" /> Suggested Format Templates:
                    </span>
                    <span className="text-[9px] text-gray-400 font-medium">Click to insert standard layout</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {isService ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setText("to Alao: 5 hours of Web Design at 15000 each, deposit paid 50000")}
                          className="px-3 py-2 text-left text-[11px] bg-white hover:bg-blue-100/10 hover:border-blue-400 text-gray-700 rounded-xl border border-gray-200 transition-all font-mono leading-relaxed"
                        >
                          <span className="text-blue-600 font-bold block text-[9px] uppercase tracking-wider mb-0.5">💻 Time/Hourly Service Format</span>
                          "to Alao: 5 hours of Web Design at 15000 each, deposit paid 50000"
                        </button>
                        <button
                          type="button"
                          onClick={() => setText("3 sessions of consulting for John Obi at 25000 each")}
                          className="px-3 py-2 text-left text-[11px] bg-white hover:bg-blue-100/10 hover:border-blue-400 text-gray-700 rounded-xl border border-gray-200 transition-all font-mono leading-relaxed"
                        >
                          <span className="text-amber-600 font-bold block text-[9px] uppercase tracking-wider mb-0.5">💼 Flat Session Service Format</span>
                          "3 sessions of consulting for John Obi at 25000 each"
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setText("sold to Baba: 15 bags of cement at 8500 each, paid 100000")}
                          className="px-3 py-2 text-left text-[11px] bg-white hover:bg-blue-100/10 hover:border-[#00A6FF]/40 text-gray-700 rounded-xl border border-gray-200 transition-all font-mono leading-relaxed shadow-sm hover:shadow"
                        >
                          <span className="text-blue-600 font-bold block text-[9px] uppercase tracking-wider mb-0.5">📦 Standard Single Item Invoice</span>
                          "sold to Baba: 15 bags of cement at 8500 each, paid 100000"
                        </button>
                        <button
                          type="button"
                          onClick={() => setText("6 sacks of flour to Alao for 32000 each, paid 120000")}
                          className="px-3 py-2 text-left text-[11px] bg-white hover:bg-blue-100/10 hover:border-[#00A6FF]/40 text-gray-700 rounded-xl border border-gray-200 transition-all font-mono leading-relaxed shadow-sm hover:shadow"
                        >
                          <span className="text-emerald-600 font-bold block text-[9px] uppercase tracking-wider mb-0.5">🌾 Bulk Price Invoice</span>
                          "6 sacks of flour to Alao for 32000 each, paid 120000"
                        </button>
                        <button
                          type="button"
                          onClick={() => setText("customer: John Obi\n5 bags of corn at 25000\n2 packs of sugar at 15000\npaid 100000")}
                          className="px-3 py-2 text-left text-[11px] bg-white hover:bg-blue-100/10 hover:border-[#00A6FF]/40 text-gray-700 rounded-xl border border-gray-200 transition-all font-mono leading-relaxed shadow-sm hover:shadow"
                        >
                          <span className="text-purple-600 font-bold block text-[9px] uppercase tracking-wider mb-0.5">📋 Multi-Item Line-by-Line list</span>
                          {"customer: John Obi\n5 bags of corn at 25000\n2 packs of sugar at 15000\npaid 100000"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* THE DEDICATED FULL-WIDTH GENERATE ACTION BUTTON */}
                <button
                  type="submit"
                  disabled={isLoading || (!text && imageQueue.length === 0 && !recordedVoiceBlob)}
                  className="w-full py-3.5 bg-[#0E1338] hover:bg-[#00A6FF] active:scale-[0.99] text-white font-extrabold uppercase tracking-widest text-xs rounded-xl shadow-lg hover:shadow-xl transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 border border-transparent disabled:opacity-40 disabled:hover:bg-[#0E1338] disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin text-[#00A6FF]" />
                      <span>Synthesizing intelligence parameters...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-[#00A6FF] shrink-0" />
                      <span>{isInvoice ? "Generate Invoice" : (isService ? "+ Save Service Offering" : "+ Add New Product")}</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 justify-between text-gray-400 text-[10px] bg-gray-50/50 p-2.5 rounded-lg">
                  <span className="font-semibold flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[#00A6FF] shrink-0" /> 
                    <span className="truncate">Notes & verbal summaries are scanned and parsed seamlessly.</span>
                  </span>
                  <span className="font-mono text-[9px] shrink-0">v1.5 Premium</span>
                </div>
              </form>
            )}
            </div>
          )
        ) : (
          /* "📝 Manual" Classic Structured Form Layout directly nested inside the widget card! */
          <form onSubmit={handleManualFormSubmit} className="space-y-4 text-xs text-gray-700 animate-fadeIn bg-gray-50/30 p-4 rounded-2xl">
            <div className="border-b pb-2 mb-3">
              <h3 className="font-display font-bold text-sm text-[#0E1338] flex items-center gap-1.5 uppercase tracking-wider">
                <Calculator className="w-4 h-4 text-[#00A6FF]" />
                Standard Transaction manual form
              </h3>
              <p className="text-[10px] text-gray-400">Add client entries instantly. Safe backup protocol when working offline.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" /> Customer Name
                </label>
                <input
                  type="text"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  placeholder="e.g. John Obi"
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-white placeholder:text-gray-400 text-gray-800 transition"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-400" /> {isService ? 'Service Provided' : 'Product / Commodity'}
                  </label>
                  <button type="button" className="text-[10px] text-[#00A6FF] font-bold hover:underline mb-1.5" onClick={() => alert('Category management coming soon!')}>+ Add Category</button>
                </div>
                <input
                  type="text"
                  value={manualProductName}
                  onChange={(e) => setManualProductName(e.target.value)}
                  placeholder={isService ? "e.g. Graphic Designing hourly, Appliance Repair" : "e.g. Rice Big Bag, Flour"}
                  className="w-full text-xs rounded-xl border border-[#0E1338]/15 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-white placeholder:text-gray-400 text-gray-800 transition shadow-sm font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5">
                  {isService ? 'Scope/Hours/Sessions' : 'Quantity'}
                </label>
                <input
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  className="w-full text-xs rounded-xl border border-[#0E1338]/15 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-white text-gray-800 transition font-bold"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5">
                  {isService ? 'Service Rate (₦)' : 'Unit Price (₦)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualUnitPrice}
                  onChange={(e) => setManualUnitPrice(e.target.value)}
                  placeholder={isService ? "e.g. 15000" : "e.g. 45000"}
                  className="w-full text-xs rounded-xl border border-[#0E1338]/15 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-white placeholder:text-gray-400 text-gray-800 transition font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-[#4A5568] uppercase tracking-wider mb-1.5 flex items-center gap-1 flex-wrap">
                  <CircleDollarSign className="w-3.5 h-3.5 text-gray-400" /> Cash Deposit (₦)
                </label>
                <input
                  type="number"
                  step="any"
                  value={manualAmountPaid}
                  onChange={(e) => setManualAmountPaid(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full text-xs rounded-xl border border-[#0E1338]/15 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] p-3 bg-white placeholder:text-gray-400 text-gray-800 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0E1338] hover:bg-[#00A6FF] text-white rounded-xl text-xs font-extrabold shadow transition uppercase tracking-widest cursor-pointer mt-2"
            >
              {isService ? 'Save Service Record' : 'Save Standard Record'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
