import { useState, useMemo, FormEvent } from 'react';
import { Customer, Invoice } from '../types';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  UserPlus, 
  Phone, 
  Calendar,
  CreditCard,
  CheckCircle2,
  Users,
  Eye,
  Check,
  X,
  FileText
} from 'lucide-react';

interface CustomersListProps {
  customers: Customer[];
  onAddCustomer: (customer: { name: string; phone?: string }) => void;
  onEditCustomer: (id: string, updated: { name: string; phone?: string }) => void;
  onDeleteCustomer?: (id: string) => void;
  onSelectCustomerInvoiceFeed: (customerName: string) => void;
}

export default function CustomersList({ 
  customers, 
  onAddCustomer, 
  onEditCustomer, 
  onDeleteCustomer, 
  onSelectCustomerInvoiceFeed 
}: CustomersListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Forms & Modal states
  const [isAddMode, setIsAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  
  // Editing individual states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // 1. Calculations
  const stats = useMemo(() => {
    const totalCount = customers.length;
    const activeDebtorsCount = customers.filter(c => c.activeDebtBalance > 0).length;
    const totalCreditBalance = customers.reduce((acc, curr) => acc + curr.activeDebtBalance, 0);
    return {
      totalCount,
      activeDebtorsCount,
      totalCreditBalance
    };
  }, [customers]);

  // Filter strategy
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.phone || '').includes(searchTerm)
    );
  }, [customers, searchTerm]);

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    let finalPhone = newPhone.trim();
    if (finalPhone.startsWith('0')) {
      finalPhone = '+234' + finalPhone.slice(1);
    }
    onAddCustomer({
      name: newName.trim(),
      phone: finalPhone || undefined
    });
    setNewName('');
    setNewPhone('');
    setIsAddMode(false);
  };

  const startEdit = (c: Customer) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      alert("Please enter a valid customer name");
      return;
    }
    let finalPhone = editPhone.trim();
    if (finalPhone.startsWith('0')) {
      finalPhone = '+234' + finalPhone.slice(1);
    }
    onEditCustomer(id, {
      name: editName.trim(),
      phone: finalPhone || undefined
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6" id="customers-list-component">
      
      {/* KPI Cards top-line sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Registered Clients</span>
            <p className="text-2xl font-bold text-gray-900 font-sans">{stats.totalCount}</p>
          </div>
          <div className="p-3 bg-blue-50 text-[#00A6FF] rounded-2xl">
            <Users className="w-6 h-6 text-[#00A6FF]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Debtors</span>
            <p className="text-2xl font-bold text-[#D32F2F] font-sans">{stats.activeDebtorsCount}</p>
          </div>
          <div className="p-3 bg-red-50 text-[#D32F2F] rounded-2xl">
            <CreditCard className="w-6 h-6 text-[#D32F2F]" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center transition hover:shadow-md">
          <div className="space-y-1">
            <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Accumulated Client Debt</span>
            <p className="text-2xl font-bold text-amber-600 font-sans">
              ₦{stats.totalCreditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Main List Area */}
        <div className="lg:col-span-8 bg-white rounded-[24px] overflow-hidden shadow-sm flex flex-col">
          <div className="px-6 py-4.5 bg-[#0E1338] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#00A6FF]" />
              <h3 className="font-serif font-extrabold text-xs uppercase tracking-wider">SME Client Directory</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search clients..."
                  className="pl-8.5 pr-3 py-1.5 w-44 bg-white/10 text-white placeholder-white/50 text-[11px] rounded-lg border-0 focus:ring-1 focus:ring-[#00A6FF] transition"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddMode(prev => !prev)}
                className="px-3 py-1.5 bg-[#00A6FF] hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> New Client
              </button>
            </div>
          </div>

          <div className="overflow-x-auto text-xs text-gray-750">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="border-b font-semibold text-gray-400 uppercase tracking-wide text-[10px] bg-gray-50/70 py-3 px-6">
                  <th className="py-3 px-6">Client / Contact Info</th>
                  <th className="py-3 px-4">Created Since</th>
                  <th className="py-3 px-4 text-center">Invoices Count</th>
                  <th className="py-3 px-4 text-right">Credit Owed</th>
                  <th className="py-3 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-gray-400 italic">
                      No matching clients found in directory index.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isEditing = editingId === cust.id;
                    const itemsInvoiced = cust.invoices?.length || 0;

                    return (
                      <tr key={cust.id} className="border-b border-gray-105 hover:bg-gray-50/40 transition duration-150">
                        
                        {/* 1. Client Info Box */}
                        <td className="py-4 px-6">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input 
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full p-2 text-xs rounded-lg border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF]"
                                required
                              />
                              <input 
                                type="text"
                                value={editPhone}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  if (val === '0') {
                                    val = '+234';
                                  } else if (val.startsWith('0')) {
                                    val = '+234' + val.slice(1);
                                  }
                                  setEditPhone(val);
                                }}
                                placeholder="Contact phone number"
                                className="w-full p-2 text-xs rounded-lg border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF]"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-[#0E1338] text-sm font-sans">{cust.name}</h4>
                              {cust.phone ? (
                                <p className="text-[10.5px] text-gray-400 flex items-center gap-1 font-mono">
                                  <Phone className="w-3 h-3" /> {cust.phone}
                                </p>
                              ) : (
                                <p className="text-[10.5px] text-gray-300 italic">No contact logged</p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 2. Registered date */}
                        <td className="py-4 px-4 text-gray-500 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            {cust.createdDate || 'N/A'}
                          </span>
                        </td>

                        {/* 3. Invoices Count */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 transition px-2 py-1 rounded text-[10.5px]">
                            {itemsInvoiced} orders
                          </span>
                        </td>

                        {/* 4. Credit Owed */}
                        <td className="py-4 px-4 text-right">
                          {cust.activeDebtBalance > 0 ? (
                            <span className="font-extrabold font-mono text-[#D32F2F] text-sm">
                              ₦{(cust.activeDebtBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-mono font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                            </span>
                          )}
                        </td>

                        {/* 5. Action controls */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(cust.id)}
                                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition"
                                  title="Save items"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition"
                                  title="Cancel edit"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(cust)}
                                  className="p-1.5 text-gray-400 hover:text-[#00A6FF] hover:bg-blue-50 rounded-lg transition"
                                  title="Edit client profile"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSelectCustomerInvoiceFeed(cust.name)}
                                  className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition flex items-center gap-1 font-bold text-[10.5px]"
                                  title="View ledger logs"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {onDeleteCustomer && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm(`Void directory list index for "${cust.name}"?`)) {
                                        onDeleteCustomer(cust.id);
                                      }
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                    title="Unregister customer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Creation Form Desk */}
        <div className="lg:col-span-4 bg-white rounded-[24px] p-6 shadow-sm flex flex-col space-y-4">
          <h3 className="font-serif font-extrabold text-[#0E1338] text-sm uppercase tracking-wide border-b pb-2">
            Register New Client
          </h3>
          
          <form onSubmit={handleAddSubmit} className="space-y-4 text-xs text-gray-750">
            <div>
              <label className="block text-[10.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                Full Customer Name *
              </label>
              <div className="relative">
                <UserPlus className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="e.g. Aliko Dangote"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] py-3 pl-10 pr-4 transition bg-gray-50/50 text-gray-800 placeholder-gray-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">
                Active Contact Phone (Optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="e.g. +234 803 123 4567"
                  value={newPhone}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === '0') {
                      val = '+234';
                    } else if (val.startsWith('0')) {
                      val = '+234' + val.slice(1);
                    }
                    setNewPhone(val);
                  }}
                  className="w-full text-xs rounded-xl border border-gray-200 focus:border-[#00A6FF] focus:ring-1 focus:ring-[#00A6FF] py-3 pl-10 pr-4 transition bg-gray-50/50 text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0E1338] hover:bg-[#00A6FF] text-white rounded-xl text-xs font-bold uppercase tracking-widest transition cursor-pointer shadow flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Save Client Record
            </button>
          </form>

          <div className="bg-[#00a6ff]/5 border border-[#00a6ff]/10 rounded-2xl p-4 text-[11px] leading-relaxed text-gray-600 font-sans space-y-1 mt-4">
            <h4 className="font-extrabold text-[#0E1338]">🔍 Multi-workspace Synced</h4>
            <p>Customers listed here display across standard interactive interfaces including automated extraction text blocks, invoices, and debt tracking tools.</p>
          </div>
        </div>

      </div>

    </div>
  );
}
