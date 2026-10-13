import React, { useState, useEffect } from 'react';
import {
  ShoppingBag, Shield, Truck, AlertCircle, CheckCircle, RefreshCw,
  Search, SlidersHorizontal, ArrowRight, User, Package, PlusCircle,
  FileText, Clock, ExternalLink, X, DollarSign, ChevronRight, Lock,
  LogIn, LogOut, Key, UserPlus,
  Award, Eye, ThumbsUp, Scale, Camera, Layers, Check
} from 'lucide-react';

export default function App() {
  // Navigation & Role states
  const [currentRole, setCurrentRole] = useState('borrower'); // 'borrower' | 'lender' | 'admin'
  const [activeTab, setActiveTab] = useState('catalog'); // for borrower: catalog | rentals | cart
  const [lenderTab, setLenderTab] = useState('suborders'); // suborders | listings | inspection
  const [adminTab, setAdminTab] = useState('overview'); // overview | ledger | disputes | audit
  // Authentication & Sessions state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rentappliances_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('borrower');
  const [authPhone, setAuthPhone] = useState('');
  const [authCity, setAuthCity] = useState('Bengaluru');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [roleMismatchPrompt, setRoleMismatchPrompt] = useState(null);

  // Data states
  const [appliances, setAppliances] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  // Cart & Calculation
  const [cart, setCart] = useState([
    { appliance_id: 'app_1', plan: 'daily', duration: 3 }
  ]);
  const [cartCalculation, setCartCalculation] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);

  // Orders, Ledger, Disputes
  const [orders, setOrders] = useState([]);
  const [subOrders, setSubOrders] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState(null);

  // Inspection & Listing forms
  const [showListingModal, setShowListingModal] = useState(false);
  const [newListing, setNewListing] = useState({
    title: '', category: 'Personal Grooming', brand: '', condition: 'Like New',
    market_value: 25000, monthly_rate: 2000, location: 'Bengaluru',
    description: '', features: 'Energy Star, Quick Chill'
  });
  const [selectedSubOrderForInspection, setSelectedSubOrderForInspection] = useState(null);
  const [inspectionForm, setInspectionForm] = useState({
    condition_grade: 'Normal Wear & Tear',
    proposed_deduction: 0,
    damage_reason: '',
    notes: 'Unit tested, all critical components functional.'
  });

  // Fetch initial data
  useEffect(() => {
    fetchAppliances();
    fetchUsers();
    fetchOrders();
    fetchSubOrders();
    fetchLedger();
    fetchDisputes();
    fetchAdminMetrics();
  }, []);

  // Recalculate cart whenever items change
  useEffect(() => {
    if (cart.length > 0) {
      fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      })
        .then(res => res.json())
        .then(data => setCartCalculation(data))
        .catch(err => console.error('Calc error:', err));
    } else {
      setCartCalculation(null);
    }
  }, [cart]);

  const fetchAppliances = async () => {
    try {
      const res = await fetch('/api/appliances');
      const data = await res.json();
      setAppliances(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubOrders = async () => {
    try {
      const res = await fetch('/api/sub-orders');
      const data = await res.json();
      setSubOrders(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/ledger');
      const data = await res.json();
      setLedgerEntries(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/disputes');
      const data = await res.json();
      setDisputes(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminMetrics = async () => {
    try {
      const res = await fetch('/api/admin/metrics');
      const data = await res.json();
      setAdminMetrics(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Authentication Handlers
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthError('Please enter both your email address and password.');
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Invalid credentials. Please enter a valid email and password.');
        setAuthLoading(false);
        return;
      }

      setCurrentUser(data.user);
      localStorage.setItem('rentappliances_user', JSON.stringify(data.user));
      localStorage.setItem('rentappliances_token', data.token);

      setCurrentRole(data.user.role);
      if (data.user.role === 'borrower') setActiveTab('catalog');
      else if (data.user.role === 'lender') setLenderTab('suborders');
      else if (data.user.role === 'admin') setAdminTab('overview');

      setRoleMismatchPrompt(null);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthError('');
    } catch (err) {
      setAuthError('Connection error: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authName.trim(),
          email: authEmail.trim(),
          password: authPassword,
          role: authRole,
          phone: authPhone.trim(),
          city: authCity.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Registration failed');
        setAuthLoading(false);
        return;
      }

      setCurrentUser(data.user);
      localStorage.setItem('rentappliances_user', JSON.stringify(data.user));
      localStorage.setItem('rentappliances_token', data.token);

      setCurrentRole(data.user.role);
      if (data.user.role === 'borrower') setActiveTab('catalog');
      else if (data.user.role === 'lender') setLenderTab('suborders');
      else if (data.user.role === 'admin') setAdminTab('overview');

      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
      setAuthPhone('');
    } catch (err) {
      setAuthError('Registration error: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rentappliances_user');
    localStorage.removeItem('rentappliances_token');
    setCurrentUser(null);
    setCurrentRole('borrower');
    setActiveTab('catalog');
  };

  const switchRoleWithAuthCheck = (targetRole) => {
    if (!currentUser) {
      if (targetRole === 'borrower') {
        setCurrentRole('borrower');
        setActiveTab('catalog');
        setRoleMismatchPrompt(null);
        return;
      }
      setRoleMismatchPrompt({
        targetRole,
        message: 'Please sign in with a ' + targetRole.toUpperCase() + ' account to access the ' + targetRole + ' portal.'
      });
      return;
    }
    if (currentUser.role === targetRole) {
      setCurrentRole(targetRole);
      if (targetRole === 'borrower') setActiveTab('catalog');
      else if (targetRole === 'lender') setLenderTab('suborders');
      else if (targetRole === 'admin') setAdminTab('overview');
      setRoleMismatchPrompt(null);
    } else {
      setRoleMismatchPrompt({
        targetRole,
        message: 'You are signed in as "' + currentUser.name + '" (' + currentUser.role.toUpperCase() + '). The ' + targetRole.toUpperCase() + ' workspace requires a ' + targetRole + ' account.'
      });
    }
  };

  // Single product at a time rental policy
  const addToCart = (applianceId, plan = 'monthly', duration = 1) => {
    // Strictly 1 product at a time
    setCart([{ appliance_id: applianceId, plan, duration }]);
    setActiveTab('cart');
  };

  const updateCartDuration = (delta) => {
    if (!cart.length) return;
    const newDuration = Math.max(1, cart[0].duration + delta);
    setCart([{ ...cart[0], duration: newDuration }]);
  };

  const removeFromCart = (index) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  // Checkout execution
  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower_id: currentUser ? currentUser.id : 'usr_borrower_1',
          items: cart,
          address: { street: 'Flat 402, Green Glen Towers', city: 'Bengaluru', pincode: '560103' },
          payment_method: 'Razorpay UPI'
        })
      });
      const data = await res.json();
      setCheckoutSuccess(data);
      setCart([]);
      fetchOrders();
      fetchSubOrders();
      fetchLedger();
      fetchAdminMetrics();
    } catch (err) {
      alert('Checkout failed: ' + err.message);
    }
  };

  // Create Listing
  const handleCreateListing = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/appliances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newListing,
          lender_id: currentUser ? currentUser.id : 'usr_lender_1',
          features: newListing.features.split(',').map(s => s.trim())
        })
      });
      if (res.ok) {
        setShowListingModal(false);
        fetchAppliances();
        alert('Appliance listed successfully!');
      }
    } catch (err) {
      alert('Failed to list: ' + err.message);
    }
  };

  // Submit Inspection
  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!selectedSubOrderForInspection) return;
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sub_order_id: selectedSubOrderForInspection.id,
          lender_id: selectedSubOrderForInspection.lender_id,
          checklist: [
            { item: 'Compressor / Motor functional', passed: true },
            { item: 'Physical casing & paint intact', passed: inspectionForm.proposed_deduction === 0 },
            { item: 'All accessories & cables present', passed: true }
          ],
          condition_grade: inspectionForm.condition_grade,
          notes: inspectionForm.notes,
          proposed_deduction: Number(inspectionForm.proposed_deduction),
          damage_reason: inspectionForm.damage_reason,
          proof_photos: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80']
        })
      });
      if (res.ok) {
        setSelectedSubOrderForInspection(null);
        fetchSubOrders();
        fetchLedger();
        fetchAdminMetrics();
        alert('Inspection report filed! Escrow ledger updated accordingly.');
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  // Resolve Dispute (Admin)
  const handleResolveDispute = async (disputeId, decision, deduction, notes) => {
    try {
      const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          authorized_deduction: deduction,
          admin_notes: notes
        })
      });
      if (res.ok) {
        fetchDisputes();
        fetchLedger();
        fetchSubOrders();
        fetchAdminMetrics();
        alert('Dispute arbitrated! Ledger settlements dispatched.');
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  // Filter appliances
  const filteredAppliances = appliances.filter(app => {
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
    const matchesSearch = !searchQuery || app.title.toLowerCase().includes(searchQuery.toLowerCase()) || app.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Personal Grooming', 'Car & Outdoor Cleaning', 'Vacuum & Floorcare', 'Garment & Fabric Care', 'Kitchen Appliances', 'DIY & Power Tools', 'Entertainment & Gadgets'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* TOP PERSONA SWITCHER BAR */}
      <header className="glass-header" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '70px' }}>
          
          {/* Brand Logo & NFR Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #2dd4bf, #0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(20, 184, 166, 0.4)'
            }}>
              <Package size={22} color="#0b0f19" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                RentAppliance <span style={{ color: '#2dd4bf' }}>Pro</span>
                <span className="badge badge-teal" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>NFR v3.0</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                15% Commission • 20% Escrow Deposit • Multi-Lender
              </div>
            </div>
          </div>

          {/* Interactive Role Switcher with Auth-Aware Protection */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.8)', padding: '0.25rem',
            borderRadius: '9999px', border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => switchRoleWithAuthCheck('borrower')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: currentRole === 'borrower' ? 'var(--teal-500)' : 'transparent',
                color: currentRole === 'borrower' ? '#0b0f19' : 'var(--text-muted)'
              }}
            >
              <ShoppingBag size={15} /> Borrower
            </button>

            <button
              onClick={() => switchRoleWithAuthCheck('lender')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: currentRole === 'lender' ? '#6366f1' : 'transparent',
                color: currentRole === 'lender' ? '#ffffff' : 'var(--text-muted)'
              }}
            >
              <Package size={15} /> Lender
            </button>

            <button
              onClick={() => switchRoleWithAuthCheck('admin')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.9rem', borderRadius: '9999px', fontSize: '0.82rem', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: currentRole === 'admin' ? '#f59e0b' : 'transparent',
                color: currentRole === 'admin' ? '#0b0f19' : 'var(--text-muted)'
              }}
            >
              <Shield size={15} /> Admin Arbitrator
            </button>
          </div>

          {/* Right Action: User profile & Cart */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {currentRole === 'borrower' && (
              <button
                onClick={() => setActiveTab('cart')}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 0.85rem', position: 'relative' }}
              >
                <ShoppingBag size={18} color="var(--teal-400)" />
                <span style={{ fontSize: '0.85rem' }}>Cart</span>
                {cart.length > 0 && (
                  <span style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    background: 'var(--rose-500)', color: '#fff', fontSize: '0.7rem',
                    width: '18px', height: '18px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700
                  }}>
                    {cart.length}
                  </span>
                )}
              </button>
            )}

            {currentUser ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.65rem',
                background: 'var(--bg-glass)', padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
              }}>
                <img
                  src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'}
                  alt={currentUser.name}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {currentUser.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700,
                      color: currentUser.role === 'admin' ? 'var(--amber-400)' : currentUser.role === 'lender' ? '#a5b4fc' : 'var(--teal-400)'
                    }}>
                      {currentUser.role.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.35rem', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setAuthEmail('');
                      setAuthPassword('');
                      setAuthError('');
                      setShowAuthModal(true);
                    }}
                    title="Switch Account / Login"
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem'
                    }}
                  >
                    <Key size={15} />
                  </button>
                  <button
                    onClick={handleLogout}
                    title="Sign Out"
                    style={{
                      background: 'none', border: 'none', color: 'var(--rose-400)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem'
                    }}
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthError('');
                  setShowAuthModal(true);
                }}
                className="btn btn-primary"
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem' }}
              >
                <LogIn size={15} /> Sign In / Register
              </button>
            )}

          </div>
        </div>
      </header>

      {/* ROLE MISMATCH / SWITCH NOTIFICATION */}
      {roleMismatchPrompt && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)', borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          padding: '0.65rem 1.25rem'
        }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.86rem', color: '#fca5a5' }}>
              <AlertCircle size={18} color="#f87171" />
              <span>{roleMismatchPrompt.message}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setAuthMode('login');
                  setAuthEmail('');
                  setAuthPassword('');
                  setAuthError('');
                  setShowAuthModal(true);
                }}
                className="btn btn-primary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Sign In to {roleMismatchPrompt.targetRole.toUpperCase()} Account
              </button>
              <button
                onClick={() => setRoleMismatchPrompt(null)}
                style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB NAVIGATION BAR DEPENDING ON ACTIVE ROLE */}
      <div style={{ background: 'rgba(17, 24, 39, 0.4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1.25rem' }}>
          {currentRole === 'borrower' && (
            <>
              <button
                onClick={() => setActiveTab('catalog')}
                style={{
                  background: 'none', border: 'none', color: activeTab === 'catalog' ? 'var(--teal-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: activeTab === 'catalog' ? '2px solid var(--teal-400)' : '2px solid transparent'
                }}
              >
                Browse Marketplace
              </button>
              <button
                onClick={() => setActiveTab('rentals')}
                style={{
                  background: 'none', border: 'none', color: activeTab === 'rentals' ? 'var(--teal-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: activeTab === 'rentals' ? '2px solid var(--teal-400)' : '2px solid transparent'
                }}
              >
                My Active Rentals ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('cart')}
                style={{
                  background: 'none', border: 'none', color: activeTab === 'cart' ? 'var(--teal-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: activeTab === 'cart' ? '2px solid var(--teal-400)' : '2px solid transparent'
                }}
              >
                Booking Cart ({cart.length} item)
              </button>
            </>
          )}

          {currentRole === 'lender' && (
            <>
              <button
                onClick={() => setLenderTab('suborders')}
                style={{
                  background: 'none', border: 'none', color: lenderTab === 'suborders' ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: lenderTab === 'suborders' ? '2px solid #a5b4fc' : '2px solid transparent'
                }}
              >
                Sub-Orders & Dispatches ({subOrders.length})
              </button>
              <button
                onClick={() => setLenderTab('listings')}
                style={{
                  background: 'none', border: 'none', color: lenderTab === 'listings' ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: lenderTab === 'listings' ? '2px solid #a5b4fc' : '2px solid transparent'
                }}
              >
                My Appliance Inventory ({appliances.filter(a => a.lender_id === 'usr_lender_1').length})
              </button>
              <button
                onClick={() => setLenderTab('inspection')}
                style={{
                  background: 'none', border: 'none', color: lenderTab === 'inspection' ? '#a5b4fc' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: lenderTab === 'inspection' ? '2px solid #a5b4fc' : '2px solid transparent'
                }}
              >
                Return Inspection Studio
              </button>
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => setShowListingModal(true)}
                  className="btn btn-indigo"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.82rem' }}
                >
                  <PlusCircle size={15} /> Add Appliance
                </button>
              </div>
            </>
          )}

          {currentRole === 'admin' && (
            <>
              <button
                onClick={() => setAdminTab('overview')}
                style={{
                  background: 'none', border: 'none', color: adminTab === 'overview' ? 'var(--amber-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: adminTab === 'overview' ? '2px solid var(--amber-400)' : '2px solid transparent'
                }}
              >
                Platform KPIs
              </button>
              <button
                onClick={() => setAdminTab('ledger')}
                style={{
                  background: 'none', border: 'none', color: adminTab === 'ledger' ? 'var(--amber-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: adminTab === 'ledger' ? '2px solid var(--amber-400)' : '2px solid transparent'
                }}
              >
                20% Escrow Deposit Ledger ({ledgerEntries.length})
              </button>
              <button
                onClick={() => setAdminTab('disputes')}
                style={{
                  background: 'none', border: 'none', color: adminTab === 'disputes' ? 'var(--amber-400)' : 'var(--text-muted)',
                  fontSize: '0.88rem', fontWeight: 600, padding: '0.4rem 0.6rem', cursor: 'pointer',
                  borderBottom: adminTab === 'disputes' ? '2px solid var(--amber-400)' : '2px solid transparent'
                }}
              >
                Dispute Arbitration Center ({disputes.filter(d => d.status === 'OPEN').length} Open)
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">

          {/* ========================================================
              BORROWER VIEW
              ======================================================== */}
          {currentRole === 'borrower' && activeTab === 'catalog' && (
            <div>
              {/* Hero Banner */}
              <div className="glass-panel" style={{
                padding: '2.5rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(99, 102, 241, 0.12))'
              }}>
                <div style={{ maxWidth: '650px' }}>
                  <div className="badge badge-teal" style={{ marginBottom: '0.85rem' }}>
                    <Shield size={13} /> 100% Escrow Protected Rental Marketplace
                  </div>
                  <h1 style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.85rem' }}>
                    Rent Hair Dryers, Vacuum Cleaners, Car Washers & Smart Tools
                  </h1>
                  <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    Transparent pricing per NFR v3.0: <strong>Fixed 15% Platform Commission</strong> & <strong>20% Refundable Security Deposit</strong> held safely in escrow. Multi-lender checkout with 3rd-party logistics.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--teal-400)' }}>
                      <CheckCircle size={16} /> Verified Appliance Condition
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--teal-400)' }}>
                      <CheckCircle size={16} /> Daily, Weekly & Monthly Plans
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--teal-400)' }}>
                      <CheckCircle size={16} /> Automated Return Inspection
                    </div>
                  </div>
                </div>
              </div>

              {/* Search & Categories Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', width: '320px' }}>
                  <Search size={18} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search hair dryer, vacuum cleaner, car washer, tools..."
                    className="input-field"
                    style={{ paddingLeft: '2.4rem' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '0.45rem 0.9rem', borderRadius: 'var(--radius-full)', fontSize: '0.82rem',
                        fontWeight: 600, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                        background: selectedCategory === cat ? 'rgba(20, 184, 166, 0.2)' : 'var(--bg-glass)',
                        borderColor: selectedCategory === cat ? 'var(--teal-500)' : 'var(--border-subtle)',
                        color: selectedCategory === cat ? 'var(--teal-400)' : 'var(--text-muted)'
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Appliances Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {filteredAppliances.map(app => (
                  <div key={app.id} className="glass-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }}>
                    
                    {/* Image & Badges */}
                    <div style={{ height: '210px', position: 'relative', overflow: 'hidden' }}>
                      <img
                        src={app.images[0] || 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80'}
                        alt={app.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                        <span className="badge badge-teal" style={{ background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(8px)' }}>
                          {app.condition}
                        </span>
                      </div>
                      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                        <span className="badge" style={{ background: 'rgba(11, 15, 25, 0.85)', backdropFilter: 'blur(8px)', color: 'var(--amber-400)' }}>
                          ★ {app.rating} ({app.total_reviews})
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
                        {app.brand} • {app.category}
                      </div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                        {app.title}
                      </h3>

                      {/* Financial breakdown pill (NFR Rule highlight) */}
                      <div style={{
                        background: 'rgba(15, 23, 42, 0.7)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                        marginBottom: '1rem', border: '1px solid var(--border-subtle)', fontSize: '0.8rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Monthly Rent:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>₹{app.monthly_rate.toLocaleString()}/mo</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Platform Fee (15% MV):</span>
                          <span style={{ color: 'var(--teal-400)' }}>₹{(app.market_value * 0.15).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-dim)' }}>Escrow Deposit (20% MV):</span>
                          <span style={{ color: '#a5b4fc', fontWeight: 600 }}>₹{(app.market_value * 0.20).toLocaleString()} <span style={{ fontSize: '0.7rem' }}>(Refundable)</span></span>
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={() => setSelectedAppliance(app)}
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: '0.85rem' }}
                        >
                          <Eye size={16} /> Details
                        </button>
                        <button
                          onClick={() => addToCart(app.id, 'monthly', 1)}
                          className="btn btn-primary"
                          style={{ flex: 1, fontSize: '0.85rem' }}
                        >
                          <ShoppingBag size={16} /> Rent Now
                        </button>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BORROWER ACTIVE RENTALS VIEW */}
          {currentRole === 'borrower' && activeTab === 'rentals' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={22} color="var(--teal-400)" /> My Active Appliance Rentals
              </h2>

              {orders.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                  <Package size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-muted)' }}>You don't have any active rentals yet.</p>
                  <button onClick={() => setActiveTab('catalog')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    Browse Marketplace
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {orders.map(order => (
                    <div key={order.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>Order #{order.order_number}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            Placed on {order.created_at} • Payment: {order.payment_method} ({order.payment_status})
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--teal-400)' }}>
                            ₹{order.grand_total.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Includes ₹{order.total_deposit.toLocaleString()} Escrow Deposit
                          </div>
                        </div>
                      </div>

                      {/* Sub-Orders list per lender */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {order.sub_orders.map(so => (
                          <div key={so.id} style={{
                            background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="badge badge-indigo">Lender Sub-Order</span>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{so.lender_name} ({so.lender_city})</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className={`badge ${so.delivery_status === 'DELIVERED' ? 'badge-emerald' : 'badge-amber'}`}>
                                  <Truck size={12} /> {so.delivery_status || 'ASSIGNED'}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                  Ref: {so.tracking_code || 'QS-TRK-7718'}
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.82rem', marginTop: '0.75rem', color: 'var(--text-muted)' }}>
                              <div>Rent Subtotal: <strong style={{ color: 'var(--text-main)' }}>₹{so.rent_subtotal.toLocaleString()}</strong></div>
                              <div>Platform Fee (15%): <strong style={{ color: 'var(--teal-400)' }}>₹{so.commission_subtotal.toLocaleString()}</strong></div>
                              <div>Escrow Deposit: <strong style={{ color: '#a5b4fc' }}>₹{so.deposit_subtotal.toLocaleString()}</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* BORROWER CART & CHECKOUT VIEW */}
          {currentRole === 'borrower' && activeTab === 'cart' && (
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShoppingBag size={24} color="var(--teal-400)" /> Rental Booking & Cost Breakdown
                <span className="badge badge-teal" style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', marginLeft: '0.5rem' }}>
                  1 Product per Booking Policy
                </span>
              </h2>

              {cart.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center' }}>
                  <ShoppingBag size={48} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Your cart is empty</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Add appliances from the marketplace to preview the transparent multi-lender order split.</p>
                  <button onClick={() => setActiveTab('catalog')} className="btn btn-primary">
                    Browse Marketplace
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                  
                  {/* Left: Cart Items & Lender Sub-Orders */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {cartCalculation?.subOrdersPreview.map((group, idx) => (
                      <div key={idx} className="glass-panel" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Package size={18} color="#a5b4fc" />
                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Sub-Order: {group.lender?.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>({group.lender?.city})</span>
                          </div>
                          <span className="badge badge-indigo" style={{ fontSize: '0.72rem' }}>
                            Logistics: ₹{group.deliveryFee}
                          </span>
                        </div>

                        {group.items.map((item, iIdx) => (
                          <div key={iIdx} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <img src={item.image} alt={item.title} style={{ width: '65px', height: '65px', borderRadius: '8px', objectFit: 'cover' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{item.title}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Market Value: ₹{item.market_value.toLocaleString()}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                                  <button
                                    type="button"
                                    onClick={() => updateCartDuration(-1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--teal-400)', fontWeight: 800, cursor: 'pointer', padding: '0 4px', fontSize: '0.9rem' }}
                                  >-</button>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{item.duration} {item.plan}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartDuration(1)}
                                    style={{ background: 'none', border: 'none', color: 'var(--teal-400)', fontWeight: 800, cursor: 'pointer', padding: '0 4px', fontSize: '0.9rem' }}
                                  >+</button>
                                </div>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--teal-400)', marginTop: '0.2rem' }}>
                                Rent: ₹{item.rent_amount.toLocaleString()} | Fee: ₹{item.commission_amount.toLocaleString()} | Deposit: ₹{item.deposit_amount.toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => removeFromCart(cart.findIndex(c => c.appliance_id === item.appliance_id))}
                              style={{ background: 'none', border: 'none', color: 'var(--rose-400)', cursor: 'pointer', padding: '0.25rem' }}
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Right: Transparent Cost Breakdown (NFR Rule 5 & 6) */}
                  <div className="glass-panel" style={{ padding: '1.5rem', position: 'sticky', top: '90px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                      Transparent Order Summary
                    </h3>

                    {cartCalculation && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Appliance Rental Total:</span>
                          <span style={{ fontWeight: 700 }}>₹{cartCalculation.summary.totalRent.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Platform Fee (15% Market Value):</span>
                            <div style={{ fontSize: '0.72rem', color: 'var(--teal-400)' }}>Explicit transparent fee</div>
                          </div>
                          <span style={{ color: 'var(--teal-400)', fontWeight: 700 }}>₹{cartCalculation.summary.totalCommission.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Security Deposit (20% Market Value):</span>
                            <div style={{ fontSize: '0.72rem', color: '#a5b4fc' }}>Held in separate escrow ledger</div>
                          </div>
                          <span style={{ color: '#a5b4fc', fontWeight: 700 }}>₹{cartCalculation.summary.totalDeposit.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Third-Party Logistics ({cartCalculation.subOrdersPreview.length} Hubs):</span>
                          <span style={{ fontWeight: 600 }}>₹{cartCalculation.summary.deliveryFee.toLocaleString()}</span>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Total Payable Today:</span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--teal-400)' }}>
                            ₹{cartCalculation.summary.grandTotal.toLocaleString()}
                          </span>
                        </div>

                        {/* Escrow guarantee notice */}
                        <div style={{
                          background: 'rgba(20, 184, 166, 0.08)', border: '1px solid rgba(20, 184, 166, 0.2)',
                          padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '0.5rem'
                        }}>
                          <Shield size={14} color="var(--teal-400)" style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          <strong>Escrow Protection:</strong> ₹{cartCalculation.summary.totalDeposit.toLocaleString()} deposit is held safe in escrow and refunded automatically upon clean return inspection.
                        </div>

                        <button
                          onClick={handleCheckout}
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '0.85rem', marginTop: '1rem', fontSize: '1rem' }}
                        >
                          Confirm & Pay ₹{cartCalculation.summary.grandTotal.toLocaleString()} <ArrowRight size={18} />
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Checkout Success Feedback */}
              {checkoutSuccess && (
                <div className="glass-panel" style={{
                  padding: '2rem', marginTop: '2rem', border: '1px solid var(--teal-500)',
                  background: 'rgba(20, 184, 166, 0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <CheckCircle size={28} color="var(--teal-400)" />
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Booking Confirmed! Order #{checkoutSuccess.orderNumber}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{checkoutSuccess.message}</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    {checkoutSuccess.subOrders.map((so, idx) => (
                      <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.85rem', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Lender Sub-Order {idx + 1}</div>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>Tracking: {so.trackingCode}</div>
                        <div style={{ fontSize: '0.78rem', color: '#a5b4fc', marginTop: '0.25rem' }}>Deposit Held: ₹{so.subDep.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setCheckoutSuccess(null); setActiveTab('rentals'); }}
                    className="btn btn-primary"
                    style={{ marginTop: '1.5rem' }}
                  >
                    View Active Rentals Timeline
                  </button>
                </div>
              )}

            </div>
          )}


          {/* ========================================================
              LENDER VIEW
              ======================================================== */}
          {currentRole === 'lender' && (
            <div>
              {/* Lender Header Summary */}
              <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div className="badge badge-indigo" style={{ marginBottom: '0.5rem' }}>Lender Dashboard</div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Welcome, Rohit Sharma</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Manage appliance listings, review incoming dispatches, and conduct return damage inspections.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Total Active Rentals</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a5b4fc' }}>{subOrders.length} Sub-Orders</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Gross Rental Earnings</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
                      ₹{subOrders.reduce((acc, s) => acc + s.rent_subtotal, 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-orders / Dispatches Tab */}
              {lenderTab === 'suborders' && (
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem' }}>Incoming & Active Rental Sub-Orders</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {subOrders.map(so => (
                      <div key={so.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>Order #{so.order_number}</span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>Borrower: {so.borrower_name} ({so.borrower_phone})</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <span className="badge badge-teal">{so.status}</span>
                            <span className="badge badge-indigo">Tracking: {so.tracking_code || 'QS-88214'}</span>
                          </div>
                        </div>

                        {/* Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                          {so.items?.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem', borderRadius: '8px' }}>
                              <img src={item.images[0]} alt={item.title} style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                                  Plan: {item.duration} {item.plan} | Rent: ₹{item.rent_amount.toLocaleString()} | Escrow Deposit: ₹{item.deposit_amount.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Actions for Lender */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                          <button
                            onClick={() => {
                              setSelectedSubOrderForInspection(so);
                              setLenderTab('inspection');
                            }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.82rem' }}
                          >
                            <FileText size={15} /> Open Return Inspection
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventory Listings Tab */}
              {lenderTab === 'listings' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Appliance Listings</h3>
                    <button onClick={() => setShowListingModal(true)} className="btn btn-indigo" style={{ fontSize: '0.85rem' }}>
                      <PlusCircle size={16} /> Add New Appliance
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                    {appliances.filter(a => a.lender_id === 'usr_lender_1').map(app => (
                      <div key={app.id} className="glass-panel" style={{ padding: '1.25rem' }}>
                        <img src={app.images[0]} alt={app.title} style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />
                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>{app.title}</h4>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
                          Market Value: ₹{app.market_value.toLocaleString()} • Status: <span style={{ color: 'var(--teal-400)' }}>{app.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700 }}>
                          <span>₹{app.monthly_rate.toLocaleString()}/mo</span>
                          <span style={{ color: '#a5b4fc' }}>Deposit: ₹{(app.market_value * 0.2).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inspection Studio Tab (NFR Section 6) */}
              {lenderTab === 'inspection' && (
                <div style={{ maxWidth: '750px', margin: '0 auto' }}>
                  <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Camera size={22} color="#a5b4fc" /> Post-Return Inspection & Damage Studio
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                      NFR standard: Inspect returned item against checklist. Normal wear & tear is not chargeable. Undisputed deposit will be released immediately to borrower; disputed deductions will be held in escrow for admin arbitration.
                    </p>

                    <form onSubmit={handleSubmitInspection}>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Select Sub-Order to Inspect:
                        </label>
                        <select
                          className="input-field"
                          value={selectedSubOrderForInspection?.id || ''}
                          onChange={(e) => {
                            const found = subOrders.find(s => s.id === e.target.value);
                            setSelectedSubOrderForInspection(found);
                          }}
                          required
                        >
                          <option value="">-- Choose Sub-Order --</option>
                          {subOrders.map(so => (
                            <option key={so.id} value={so.id}>
                              Order #{so.order_number} ({so.items?.[0]?.title || 'Appliance'}) - Borrower: {so.borrower_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Condition Grade:
                        </label>
                        <select
                          className="input-field"
                          value={inspectionForm.condition_grade}
                          onChange={(e) => setInspectionForm({ ...inspectionForm, condition_grade: e.target.value })}
                        >
                          <option value="Pristine / No Damage">Pristine / No Damage (100% Full Refund)</option>
                          <option value="Normal Wear & Tear">Normal Wear & Tear (Zero Deduction)</option>
                          <option value="Minor Damage">Minor Damage (Proposed Repair Deduction)</option>
                          <option value="Severe Damage / Missing Parts">Severe Damage / Missing Parts</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Proposed Damage Deduction (₹):
                        </label>
                        <input
                          type="number"
                          className="input-field"
                          value={inspectionForm.proposed_deduction}
                          onChange={(e) => setInspectionForm({ ...inspectionForm, proposed_deduction: e.target.value })}
                          placeholder="0 for full refund"
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Must be supported by clear photo evidence & repair estimation.
                        </span>
                      </div>

                      {Number(inspectionForm.proposed_deduction) > 0 && (
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                            Specific Damage Reason:
                          </label>
                          <input
                            type="text"
                            className="input-field"
                            value={inspectionForm.damage_reason}
                            onChange={(e) => setInspectionForm({ ...inspectionForm, damage_reason: e.target.value })}
                            placeholder="e.g. Cracked outer bezel, broken refrigerator tray"
                            required
                          />
                        </div>
                      )}

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                          Inspection Checklist & Notes:
                        </label>
                        <textarea
                          rows={3}
                          className="input-field"
                          value={inspectionForm.notes}
                          onChange={(e) => setInspectionForm({ ...inspectionForm, notes: e.target.value })}
                        />
                      </div>

                      <button type="submit" className="btn btn-indigo" style={{ width: '100%', padding: '0.85rem' }}>
                        Submit Inspection & Trigger Deposit Settlement
                      </button>
                    </form>
                  </div>
                </div>
              )}

            </div>
          )}


          {/* ========================================================
              ADMIN COMMAND CENTER
              ======================================================== */}
          {currentRole === 'admin' && (
            <div>
              {/* Live KPI Stat Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Platform 15% Commission Pool</span>
                    <DollarSign size={18} color="var(--teal-400)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--teal-400)' }}>
                    ₹{adminMetrics?.totalCommission?.toLocaleString() || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>15% of Market Value per booked item</div>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>20% Escrow Deposits in Custody</span>
                    <Lock size={18} color="#a5b4fc" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a5b4fc' }}>
                    ₹{adminMetrics?.escrowHeld?.toLocaleString() || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Separated strictly from company revenue</div>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Total Deposits Refunded</span>
                    <CheckCircle size={18} color="var(--emerald-400)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
                    ₹{adminMetrics?.totalRefunded?.toLocaleString() || 0}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Clean return post-inspections</div>
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Disputes Pending Arbitration</span>
                    <Scale size={18} color="var(--amber-400)" />
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--amber-400)' }}>
                    {adminMetrics?.openDisputes || 0} Cases
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Awaiting admin evidence decision</div>
                </div>
              </div>

              {/* OVERVIEW / RECENT LOGS */}
              {adminTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>Active Disputes Needing Attention</h3>
                    {disputes.filter(d => d.status === 'OPEN').length === 0 ? (
                      <p style={{ color: 'var(--text-muted)' }}>No pending disputes at this time.</p>
                    ) : (
                      disputes.filter(d => d.status === 'OPEN').map(d => (
                        <div key={d.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--amber-400)' }}>Dispute on Order #{d.order_number}</span>
                            <span style={{ fontWeight: 700 }}>₹{d.claim_amount.toLocaleString()} claimed</span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                            Borrower: {d.borrower_statement}
                          </p>
                          <button onClick={() => setAdminTab('disputes')} className="btn btn-secondary" style={{ fontSize: '0.78rem' }}>
                            Go to Arbitration Center →
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem' }}>Real-Time Audit Trail</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {adminMetrics?.auditLogs?.map(log => (
                        <div key={log.id} style={{ fontSize: '0.78rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--teal-400)' }}>[{log.action}]</span> {log.actor_name}
                          <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>{log.created_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ESCROW DEPOSIT LEDGER TAB (NFR Section 6) */}
              {adminTab === 'ledger' && (
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Deposit Escrow Ledger</h3>
                      <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                        Immutable record of 20% security deposits: collection, holding in escrow, partial releases, and arbitration refunds.
                      </p>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
                          <th style={{ padding: '0.75rem' }}>Order / Sub-Order</th>
                          <th style={{ padding: '0.75rem' }}>Borrower</th>
                          <th style={{ padding: '0.75rem' }}>Lender</th>
                          <th style={{ padding: '0.75rem' }}>Total 20% Deposit</th>
                          <th style={{ padding: '0.75rem' }}>Escrow Held</th>
                          <th style={{ padding: '0.75rem' }}>Refunded</th>
                          <th style={{ padding: '0.75rem' }}>Deducted</th>
                          <th style={{ padding: '0.75rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerEntries.map(entry => (
                          <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>#{entry.order_number}</td>
                            <td style={{ padding: '0.75rem' }}>{entry.borrower_name}</td>
                            <td style={{ padding: '0.75rem' }}>{entry.lender_name}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 700 }}>₹{entry.total_deposit.toLocaleString()}</td>
                            <td style={{ padding: '0.75rem', color: entry.held_amount > 0 ? '#a5b4fc' : 'var(--text-dim)', fontWeight: 700 }}>
                              ₹{entry.held_amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--emerald-400)' }}>
                              ₹{entry.refunded_amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem', color: entry.deducted_amount > 0 ? 'var(--rose-400)' : 'var(--text-dim)' }}>
                              ₹{entry.deducted_amount.toLocaleString()}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span className={`badge ${
                                entry.status === 'HELD' ? 'badge-indigo' :
                                entry.status === 'REFUNDED' ? 'badge-emerald' :
                                entry.status === 'DISPUTED' ? 'badge-amber' : 'badge-teal'
                              }`}>
                                {entry.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DISPUTE ARBITRATION CENTER TAB (NFR Section 6 & 11) */}
              {adminTab === 'disputes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {disputes.map(disp => (
                    <div key={disp.id} className="glass-panel" style={{ padding: '1.75rem', border: disp.status === 'OPEN' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>Dispute #{disp.id} on Order #{disp.order_number}</span>
                          <span className={`badge ${disp.status === 'OPEN' ? 'badge-amber' : 'badge-emerald'}`} style={{ marginLeft: '0.75rem' }}>
                            {disp.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--rose-400)' }}>
                          Disputed Escrow Amount: ₹{disp.claim_amount.toLocaleString()}
                        </div>
                      </div>

                      {/* Side by Side Lender Claim vs Borrower Statement */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        {/* Lender's claim */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '0.3rem' }}>
                            LENDER CLAIM ({disp.lender_name})
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                            Reason: {disp.dispute_reason}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Notes: {disp.inspection_notes || 'Damage noted during return check.'}
                          </div>
                          {disp.proof_photos?.length > 0 && (
                            <img src={disp.proof_photos[0]} alt="Evidence" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }} />
                          )}
                        </div>

                        {/* Borrower's rebuttal */}
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--teal-400)', fontWeight: 700, marginBottom: '0.3rem' }}>
                            BORROWER REBUTTAL ({disp.borrower_name})
                          </div>
                          <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5, marginTop: '0.4rem' }}>
                            "{disp.borrower_statement}"
                          </div>
                        </div>
                      </div>

                      {/* Admin Decision Actions */}
                      {disp.status === 'OPEN' ? (
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--amber-400)', marginBottom: '0.75rem' }}>
                            Arbitrate and Release Escrow Funds:
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleResolveDispute(disp.id, 'APPROVED_FULL_CLAIM', disp.claim_amount, 'Photo evidence supports lender damage claim.')}
                              className="btn btn-danger"
                              style={{ fontSize: '0.82rem' }}
                            >
                              Authorize Full Claim (₹{disp.claim_amount} to Lender)
                            </button>

                            <button
                              onClick={() => handleResolveDispute(disp.id, 'SPLIT_50_50', Math.round(disp.claim_amount / 2), 'Fair settlement: 50% wear-and-tear allowance.')}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.82rem' }}
                            >
                              50/50 Split (₹{Math.round(disp.claim_amount / 2)} to Each)
                            </button>

                            <button
                              onClick={() => handleResolveDispute(disp.id, 'DISMISSED_NORMAL_WEAR', 0, 'Classified as normal wear and tear under NFR standard.')}
                              className="btn btn-primary"
                              style={{ fontSize: '0.82rem' }}
                            >
                              Dismiss Claim (100% Refunded to Borrower)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.85rem' }}>
                          <CheckCircle size={15} color="var(--emerald-400)" style={{ verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          <strong>Arbitration Decision:</strong> {disp.admin_decision} • Authorized Deduction: ₹{disp.resolved_deduction?.toLocaleString()} • Note: {disp.admin_notes}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(11, 15, 25, 0.9)', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
        <div className="container">
          Home Appliance Rental Marketplace • Compliant with Practical NFR v3.0 (Fixed 15% Commission & 20% Escrow Deposit)
        </div>
      </footer>

      {/* APPLIANCE DETAIL MODAL */}
      {selectedAppliance && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.25rem' }}>
          <div className="glass-panel" style={{ maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', position: 'relative' }}>
            <button
              onClick={() => setSelectedAppliance(null)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>

            <img
              src={selectedAppliance.images[0]}
              alt={selectedAppliance.title}
              style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="badge badge-teal">{selectedAppliance.condition}</span>
              <span className="badge badge-indigo">{selectedAppliance.category}</span>
            </div>

            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem' }}>{selectedAppliance.title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              {selectedAppliance.description}
            </p>

            {/* Features */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {selectedAppliance.features?.map((f, idx) => (
                <span key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                  ✓ {f}
                </span>
              ))}
            </div>

            {/* Transparent Rate Card */}
            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                Rental Rate Plans (Selectable)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div style={{ background: 'var(--bg-glass)', padding: '0.65rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Daily</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>₹{selectedAppliance.daily_rate}/day</div>
                </div>
                <div style={{ background: 'var(--bg-glass)', padding: '0.65rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Weekly</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>₹{selectedAppliance.weekly_rate}/wk</div>
                </div>
                <div style={{ background: 'rgba(20, 184, 166, 0.15)', border: '1px solid var(--teal-500)', padding: '0.65rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--teal-400)' }}>Monthly (Popular)</div>
                  <div style={{ fontWeight: 800, color: 'var(--teal-400)' }}>₹{selectedAppliance.monthly_rate}/mo</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.85rem', fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Product Market Value: <strong>₹{selectedAppliance.market_value.toLocaleString()}</strong></span>
                <span style={{ color: '#a5b4fc' }}>Refundable Escrow Deposit (20%): <strong>₹{(selectedAppliance.market_value * 0.2).toLocaleString()}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  addToCart(selectedAppliance.id, 'monthly', 1);
                  setSelectedAppliance(null);
                }}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.85rem' }}
              >
                Add to Cart & Proceed to Checkout
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD APPLIANCE MODAL (Lender) */}
      {showListingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.25rem' }}>
          <div className="glass-panel" style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', position: 'relative' }}>
            <button
              onClick={() => setShowListingModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.25rem' }}>List an Appliance for Rent</h3>
            <form onSubmit={handleCreateListing}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bosch 8kg Front Load Washing Machine"
                  className="input-field"
                  value={newListing.title}
                  onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Category</label>
                  <select
                    className="input-field"
                    value={newListing.category}
                    onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                  >
                    {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Brand</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LG, Samsung"
                    className="input-field"
                    value={newListing.brand}
                    onChange={(e) => setNewListing({ ...newListing, brand: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Market Value (₹)</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={newListing.market_value}
                    onChange={(e) => setNewListing({ ...newListing, market_value: e.target.value })}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Deposit will be 20%: ₹{Math.round(newListing.market_value * 0.2).toLocaleString()}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Monthly Rent (₹)</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={newListing.monthly_rate}
                    onChange={(e) => setNewListing({ ...newListing, monthly_rate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Key Features (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Inverter Motor, 5-Star Energy, Quick Wash"
                  className="input-field"
                  value={newListing.features}
                  onChange={(e) => setNewListing({ ...newListing, features: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-indigo" style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem' }}>
                Publish Appliance Listing
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          AUTHENTICATION & LOGIN MODAL
          ======================================================== */}
      {showAuthModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade" style={{
            maxWidth: '480px', width: '100%', padding: '2rem',
            background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-focus)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(20, 184, 166, 0.2)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2dd4bf, #0d9488)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Lock size={18} color="#0b0f19" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>RentAppliance Pro</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Secure Multi-Role Authentication</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Credential Reference Guide */}
            <div style={{
              background: 'rgba(20, 184, 166, 0.06)', border: '1px solid rgba(20, 184, 166, 0.25)',
              borderRadius: 'var(--radius-sm)', padding: '0.85rem', marginBottom: '1.25rem'
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--teal-400)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Key size={14} /> Available Accounts (Enter credentials below manually):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <span><ShoppingBag size={13} color="var(--teal-400)" style={{ verticalAlign: 'middle', marginRight: '4px' }} /><strong>Borrower:</strong></span>
                  <span>Email: <code style={{ color: 'var(--teal-400)' }}>aarav@example.com</code> | Pass: <code style={{ color: 'var(--teal-400)' }}>Borrower@123</code></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <span><Package size={13} color="#a5b4fc" style={{ verticalAlign: 'middle', marginRight: '4px' }} /><strong>Lender:</strong></span>
                  <span>Email: <code style={{ color: '#a5b4fc' }}>rohit@example.com</code> | Pass: <code style={{ color: '#a5b4fc' }}>Lender@123</code></span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <span><Shield size={13} color="var(--amber-400)" style={{ verticalAlign: 'middle', marginRight: '4px' }} /><strong>Admin:</strong></span>
                  <span>Email: <code style={{ color: 'var(--amber-400)' }}>admin@rentappliances.com</code> | Pass: <code style={{ color: 'var(--amber-400)' }}>Admin@123</code></span>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem'
            }}>
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                style={{
                  flex: 1, padding: '0.6rem', background: 'none', border: 'none',
                  borderBottom: authMode === 'login' ? '2px solid var(--teal-400)' : '2px solid transparent',
                  color: authMode === 'login' ? 'var(--teal-400)' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                style={{
                  flex: 1, padding: '0.6rem', background: 'none', border: 'none',
                  borderBottom: authMode === 'register' ? '2px solid var(--teal-400)' : '2px solid transparent',
                  color: authMode === 'register' ? 'var(--teal-400)' : 'var(--text-muted)',
                  fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer'
                }}
              >
                Create Account
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <AlertCircle size={16} color="#f87171" />
                <span>{authError}</span>
              </div>
            )}

            {/* Form */}
            {authMode === 'login' ? (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email (e.g. aarav@example.com)"
                    className="input-field"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password (e.g. Borrower@123)"
                    className="input-field"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
                >
                  {authLoading ? 'Signing In...' : 'Sign In'} <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Seth"
                    className="input-field"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Account Role
                    </label>
                    <select
                      className="input-field"
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value)}
                    >
                      <option value="borrower">Borrower</option>
                      <option value="lender">Lender</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      City
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={authCity}
                      onChange={(e) => setAuthCity(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. user@example.com"
                    className="input-field"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98..."
                      className="input-field"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min 6 characters"
                      className="input-field"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
                >
                  {authLoading ? 'Creating Account...' : 'Create Account'} <ArrowRight size={18} />
                </button>
              </form>
            )}

            </div>
        </div>
      )}

    </div>
  );
}
