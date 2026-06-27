import React, { useState } from 'react';
import { Mail, MessageSquare, Phone, Facebook, Instagram, ArrowLeft, CheckCircle, Send, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface ContactPageProps {
  onNavigate: (screen: 'landing' | 'login' | 'about' | 'terms' | 'privacy' | 'guest_invoice' | 'dashboard' | 'debtors' | 'profile' | 'invoice_preview' | 'products' | 'invoices' | 'customers' | 'terminal' | 'pricing' | 'reset_pin' | 'contact') => void;
  isAuthenticated: boolean;
}

export default function ContactPage({ onNavigate, isAuthenticated }: ContactPageProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    category: 'General Support',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setErrorMessage('Please fill in all required fields (Name, Email, Message).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await apiFetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();

      if (response.ok && resData.status === 'success') {
        setSubmitSuccess(true);
        setFormData({
          name: '',
          email: '',
          whatsapp: '',
          category: 'General Support',
          message: ''
        });
      } else {
        setErrorMessage(resData.error || 'Failed to submit contact message. Please try again.');
      }
    } catch (error: any) {
      setErrorMessage('A connection error occurred. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn min-h-screen max-w-7xl mx-auto px-4 py-6">
      
      {/* Back Button Navigation */}
      <div className="flex items-center">
        <button
          onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'landing')}
          className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl border border-gray-150 transition flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to {isAuthenticated ? 'Dashboard' : 'Homepage'}
        </button>
      </div>

      {/* Main Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="px-3 py-1 bg-[#00A6FF]/10 text-[#00A6FF] rounded-full text-[10px] font-extrabold uppercase tracking-widest">
          GET IN TOUCH
        </span>
        <h1 className="text-3xl md:text-4xl font-serif font-black text-[#0E1338] tracking-tight">
          Contact Website Ownership & Support
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Have an inquiry, technical issue, custom license request, or feedback about Yeedem Books? Use the direct touch points or fill the secure form below to log a support ticket directly with our engineering team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Direct channels list */}
        <div className="lg:col-span-5 space-y-6">
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-[#0E1338] border-b border-gray-100 pb-2">
            Direct Support Channels
          </h2>

          <div className="space-y-4">
            
            {/* Email Support */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3 flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                <Mail size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">Email Inquiry Desk</h3>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Drop us a message directly. We typically reply within 12-24 hours.
                </p>
                <a href="mailto:hello@yeedem.com" className="text-blue-500 font-bold font-mono text-xs hover:underline block pt-1">
                  hello@yeedem.com
                </a>
              </div>
            </div>

            {/* WhatsApp Contact */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-100 space-y-3 flex gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                <Phone size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider">WhatsApp Direct Help</h3>
                <p className="text-gray-500 text-[11px] leading-relaxed">
                  Chat with a support agent instantly on WhatsApp for rapid assistance.
                </p>
                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <span className="text-emerald-650 font-bold font-mono text-xs block self-center">
                    +234 812 155 3818
                  </span>
                  <a 
                    href="https://wa.me/2348121553818?text=Hello%20Yeedem%20Books%20Support,%20I%20have%20an%20inquiry%20about..."
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    <MessageSquare size={12} /> Launch Chat
                  </a>
                </div>
              </div>
            </div>

            {/* Social Channels */}
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-gray-150 space-y-3">
              <h3 className="font-bold text-[#0E1338] text-xs uppercase tracking-wider flex items-center gap-2">
                👥 Social Media Handles
              </h3>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                Follow Yeedem Tech on social platforms for bookkeeping tips, server status alerts, and feature updates.
              </p>
              
              <div className="pt-2 space-y-2.5">
                <a 
                  href="https://www.facebook.com/share/18josg5sYw/"
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-xl transition text-xs font-semibold text-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <Facebook size={16} className="text-blue-600" />
                    <span>Yeedem Tech in Facebook</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Share / Follow</span>
                </a>

                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold text-gray-700">
                  <span className="flex items-center gap-2">
                    <Instagram size={16} className="text-pink-600" />
                    <span>Yeedem Tech in IG</span>
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Active</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-[#0E1338] border-b border-gray-100 pb-2">
            Secure Service Contact Form
          </h2>

          {submitSuccess ? (
            <div className="p-8 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto shadow-lg border border-emerald-150 shadow-emerald-100">
                <CheckCircle size={32} />
              </div>
              <h3 className="font-serif font-extrabold text-[#0E1338] text-lg">Message Registered Successfully</h3>
              <p className="text-gray-500 text-xs max-w-md mx-auto leading-relaxed">
                Thank you for contacting Yeedem Tech. Your support request has been logged inside our master database. Our administrators have been notified and will review your ticket shortly.
              </p>
              <button 
                onClick={() => setSubmitSuccess(false)}
                className="px-5 py-2.5 bg-[#00A6FF] hover:bg-[#0095E6] text-white text-xs font-bold rounded-xl transition shadow cursor-pointer mt-4"
              >
                Submit Another Inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-xl text-rose-600 text-xs font-medium">
                  ⚠️ {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-[#0E1338] uppercase tracking-wider">Your Name <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    name="name" 
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Full name or company name"
                    className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 outline-none focus:bg-white focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-[#0E1338] uppercase tracking-wider">Email Address <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    name="email" 
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. sender@example.com"
                    className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 outline-none focus:bg-white focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-[#0E1338] uppercase tracking-wider">WhatsApp Line (Optional)</label>
                  <input 
                    type="tel" 
                    name="whatsapp" 
                    value={formData.whatsapp}
                    onChange={handleInputChange}
                    placeholder="e.g. +2348121553818"
                    className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 outline-none focus:bg-white focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-[#0E1338] uppercase tracking-wider">Subject / Category</label>
                  <select 
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 outline-none focus:bg-white focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition"
                  >
                    <option value="General Support">General Support</option>
                    <option value="Billing / Custom Quote">Billing / Custom Quote</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Business Partnership">Business Partnership</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-[#0E1338] uppercase tracking-wider">Detailed Message <span className="text-red-500">*</span></label>
                <textarea 
                  name="message" 
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder="Describe your inquiry or the assistance you need in detail..."
                  className="w-full text-xs rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 outline-none focus:bg-white focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] transition resize-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#00A6FF] hover:bg-[#0095E6] disabled:bg-blue-400 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering Message...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Transmit Secure Message
                  </>
                )}
              </button>

            </form>
          )}
        </div>

      </div>

    </div>
  );
}
