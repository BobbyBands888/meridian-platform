import React, { useState, useEffect } from 'react';
import { ChevronDown, Plus, Search, MapPin, Home, DollarSign, MessageSquare, Star, Menu, X, LogOut, LogIn, AlertCircle, CheckCircle, Clock, TrendingUp, Users, BarChart3, Shield, Phone, Mail } from 'lucide-react';

const MarketplaceCompleteMVP = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [currentPage, setCurrentPage] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // CORE DATA STRUCTURES
  const [listings, setListings] = useState([
    { 
      id: 1, 
      title: 'Modern Home in Belmont', 
      price: 425000, 
      beds: 3, 
      baths: 2.5, 
      neighborhood: 'Belmont', 
      image: '🏠', 
      sqft: 2100, 
      seller: 'John D.',
      sellerId: 'seller1',
      photos: 3,
      daysSinceListed: 5,
      inquiries: 8,
      completeness: 95,
      priceGuidance: '400-450k',
      views: 247,
      verified: true,
      description: 'Beautiful modern home with updated kitchen and hardwood floors.'
    },
    { 
      id: 2, 
      title: 'Craftsman in East Nashville', 
      price: 380000, 
      beds: 4, 
      baths: 2, 
      neighborhood: 'East Nashville', 
      image: '🏡', 
      sqft: 2400, 
      seller: 'Sarah M.',
      sellerId: 'seller2',
      photos: 5,
      daysSinceListed: 12,
      inquiries: 5,
      completeness: 100,
      priceGuidance: '360-400k',
      views: 189,
      verified: true,
      description: 'Original hardwood floors, period details, large lot.'
    },
  ]);

  const [vendors, setVendors] = useState([
    { 
      id: 1, 
      name: 'Nashville Photo Co.', 
      category: 'Photography', 
      price: '$250-400/session', 
      rating: 4.9, 
      reviews: 32, 
      phone: '(615) 555-0101',
      verified: true,
      insured: true,
      badge: 'premium',
      inquiriesThisWeek: 5,
      responseTime: '2h',
      completeness: 100,
      description: 'Professional real estate photography with drone options.'
    },
    { 
      id: 2, 
      name: 'Pro Home Inspector TN', 
      category: 'Home Inspection', 
      price: '$400-500', 
      rating: 4.8, 
      reviews: 28, 
      phone: '(615) 555-0102',
      verified: true,
      insured: true,
      badge: 'standard',
      inquiriesThisWeek: 3,
      responseTime: '4h',
      completeness: 85,
      description: 'Thorough inspections with detailed reports.'
    },
  ]);

  const [messages, setMessages] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [userProfiles, setUserProfiles] = useState({
    buyer1: { name: 'Alex Johnson', email: 'alex@email.com', phone: '(615) 555-1234', verified: true, badge: 'verified-email' },
    seller1: { name: 'John D.', email: 'john@email.com', phone: '(615) 555-5678', verified: true, badge: 'verified-seller' },
    vendor1: { name: 'Nashville Photo Co.', email: 'photos@email.com', phone: '(615) 555-0101', verified: true, badge: 'verified-vendor' },
  });

  const [analytics, setAnalytics] = useState({
    totalListings: listings.length,
    totalVendors: vendors.length,
    totalTransactions: 23,
    monthlyRevenue: 8500,
    platformGrowth: 15,
    churnRate: 5,
    avgResponseTime: '3h',
    userRetention: 92,
  });

  // VERIFICATION FLOW
  const handleSignup = (type) => {
    setCurrentPage('verification');
    setUserType(type);
  };

  const handleVerification = (formData) => {
    const newUser = {
      id: `${userType}${Math.random()}`,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      type: userType,
      verified: true,
      verifiedEmail: true,
      verifiedPhone: false, // Would need SMS in production
      createdAt: new Date(),
    };
    setCurrentUser(newUser);
    setUserProfiles({ ...userProfiles, [newUser.id]: newUser });
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserType(null);
    setCurrentPage('home');
  };

  // LISTING QUALITY SCORING
  const calculateListingCompleteness = (listing) => {
    let score = 0;
    if (listing.photos && listing.photos >= 3) score += 30;
    if (listing.description && listing.description.length > 50) score += 20;
    if (listing.price && listing.price > 0) score += 20;
    if (listing.priceGuidance) score += 20;
    if (listing.verified) score += 10;
    return Math.min(score, 100);
  };

  // CHURN TRACKING
  const checkVendorEngagement = (vendor) => {
    const lastActive = Math.random() * 30; // Days since last active
    return {
      isActive: lastActive < 7,
      daysSinceActive: Math.floor(lastActive),
      riskLevel: lastActive > 14 ? 'high' : lastActive > 7 ? 'medium' : 'low',
    };
  };

  // HEADER
  const Header = () => (
    <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setCurrentPage('home'); setCurrentUser(null); setUserType(null); }}>
            <Home className="w-8 h-8 text-emerald-400" />
            <span className="text-2xl font-bold">Nashville Direct</span>
            <span className="text-xs bg-emerald-500 px-2 py-1 rounded ml-2">Marketplace</span>
          </div>

          <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <nav className="hidden md:flex items-center gap-6">
            {!currentUser ? (
              <>
                <button onClick={() => handleSignup('buyer')} className="hover:text-emerald-400 transition">Buy</button>
                <button onClick={() => handleSignup('seller')} className="hover:text-emerald-400 transition">Sell</button>
                <button onClick={() => handleSignup('vendor')} className="hover:text-emerald-400 transition">Vendors</button>
                <button onClick={() => setCurrentPage('legal')} className="text-xs hover:text-slate-400">Legal</button>
              </>
            ) : (
              <>
                <span className="text-sm">Welcome, {currentUser.name}</span>
                <button onClick={handleLogout} className="hover:text-red-400 transition flex items-center gap-1">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            )}
          </nav>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-slate-700 flex flex-col gap-3">
            {!currentUser ? (
              <>
                <button onClick={() => { handleSignup('buyer'); setMobileMenuOpen(false); }} className="text-left hover:text-emerald-400">Buy</button>
                <button onClick={() => { handleSignup('seller'); setMobileMenuOpen(false); }} className="text-left hover:text-emerald-400">Sell</button>
                <button onClick={() => { handleSignup('vendor'); setMobileMenuOpen(false); }} className="text-left hover:text-emerald-400">Vendors</button>
              </>
            ) : (
              <>
                <span className="text-sm">{currentUser.name}</span>
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="text-left hover:text-red-400 flex items-center gap-1">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );

  // HOME PAGE
  const HomePage = () => (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-slate-900 mb-4">Buy. Sell. Direct.</h1>
          <p className="text-xl text-slate-600 mb-8">Connect directly with buyers, sellers, and professionals. Professional coordination. Transparent pricing.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => handleSignup('buyer')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold transition">
              Browse Homes
            </button>
            <button onClick={() => handleSignup('seller')} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-semibold transition">
              List Your Home
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 my-16">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="text-lg font-semibold mb-2">Direct Connections</h3>
            <p className="text-slate-600 text-sm">Connect with buyers and sellers actively using our platform.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="text-3xl mb-3">🔧</div>
            <h3 className="text-lg font-semibold mb-2">Professional Network</h3>
            <p className="text-slate-600 text-sm">Pre-vetted photographers, inspectors, attorneys, and contractors.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="text-3xl mb-3">✓</div>
            <h3 className="text-lg font-semibold mb-2">Verified & Safe</h3>
            <p className="text-slate-600 text-sm">Verified users, reviews, and built-in closing coordination.</p>
          </div>
        </div>

        <div className="bg-emerald-50 p-8 rounded-lg border border-emerald-200 text-center">
          <p className="text-emerald-900 text-sm font-semibold">Trusted by Nashville</p>
          <p className="text-emerald-800 mt-1">{listings.length} Active Listings • {vendors.length} Verified Vendors • Transactions Facilitated: {analytics.totalTransactions}</p>
        </div>
      </div>
    </div>
  );

  // VERIFICATION FLOW
  const VerificationFlow = () => (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Create Your Account</h2>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleVerification({
            name: e.target.name.value,
            email: e.target.email.value,
            phone: e.target.phone.value,
          });
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input type="text" name="name" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email (Verified ✓)</label>
            <input type="email" name="email" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p className="text-xs text-emerald-600 mt-1">✓ Verification email will be sent</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input type="tel" name="phone" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <p className="text-xs text-slate-500 mt-1">For important transaction notifications</p>
          </div>
          <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-semibold transition">
            Create Account
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Privacy & Trust:</strong> Your information is secure. We only share details with verified users you choose to contact.
          </p>
        </div>

        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-600">
            <strong>Legal Disclaimer:</strong> We connect buyers, sellers, and professionals. We do not practice real estate law, hold funds, or facilitate closings. See our <button onClick={() => setCurrentPage('legal')} className="text-blue-600 hover:underline">full legal terms</button>.
          </p>
        </div>
      </div>
    </div>
  );

  // BUYER DASHBOARD
  const BuyerDashboard = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Homes Viewed</p>
          <p className="text-3xl font-bold text-slate-900">12</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Saved Listings</p>
          <p className="text-3xl font-bold text-emerald-600">5</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Messages</p>
          <p className="text-3xl font-bold text-slate-900">3</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Inquiries Sent</p>
          <p className="text-3xl font-bold text-slate-900">2</p>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Featured Homes in Nashville</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {listings.map(listing => (
          <div key={listing.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition">
            <div className="relative bg-gradient-to-br from-slate-200 to-slate-300 h-48 flex items-center justify-center text-6xl">
              {listing.image}
              {listing.verified && <div className="absolute top-2 right-2 bg-emerald-500 text-white px-2 py-1 rounded text-xs font-semibold">✓ Verified</div>}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{listing.title}</h3>
              <p className="text-2xl font-bold text-emerald-600 mb-2">${(listing.price / 1000).toFixed(0)}k</p>
              
              <div className="flex gap-4 text-sm text-slate-600 mb-3">
                <span>{listing.beds} bd</span>
                <span>{listing.baths} ba</span>
                <span>{listing.sqft.toLocaleString()} sqft</span>
              </div>

              <div className="border-t pt-3 mb-3 text-xs text-slate-600">
                <p className="flex items-center gap-1 mb-1"><MapPin className="w-3 h-3" /> {listing.neighborhood}</p>
                <p className="flex items-center gap-1 mb-1"><TrendingUp className="w-3 h-3" /> {listing.views} views</p>
                <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Listed {listing.daysSinceListed} days ago</p>
              </div>

              <div className="bg-blue-50 p-2 rounded mb-3 text-xs text-blue-800 border border-blue-200">
                <strong>Price Guidance:</strong> Similar homes: {listing.priceGuidance}
              </div>

              <button onClick={() => setMessages([...messages, { id: messages.length + 1, from: currentUser.name, to: listing.seller, subject: `Interest in ${listing.title}`, message: 'Hi, interested in learning more about this property.' }])} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-lg font-semibold transition text-sm">
                Contact Seller
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-6">Professional Services</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        {vendors.map(vendor => {
          const engagement = checkVendorEngagement(vendor);
          return (
            <div key={vendor.id} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-slate-900">{vendor.name}</h4>
                  <p className="text-sm text-slate-600">{vendor.category}</p>
                </div>
                <div className="flex gap-1">
                  {vendor.verified && <Shield className="w-4 h-4 text-emerald-500" title="Verified" />}
                  {vendor.insured && <CheckCircle className="w-4 h-4 text-emerald-500" title="Insured" />}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold">{vendor.rating}</span>
                </div>
                <span className="text-xs text-slate-600">{vendor.reviews} reviews</span>
              </div>

              <p className="text-sm text-emerald-600 font-semibold mb-2">{vendor.price}</p>
              <p className="text-xs text-slate-600 mb-3">{vendor.description}</p>

              <button onClick={() => setMessages([...messages, { id: messages.length + 1, from: currentUser.name, to: vendor.name, subject: `Inquiry: ${vendor.category}` }])} className="w-full border border-emerald-500 text-emerald-600 hover:bg-emerald-50 py-2 rounded-lg font-semibold transition text-sm">
                Request Services
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  // SELLER DASHBOARD
  const SellerDashboard = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Sell Your Home</h2>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Your Listings</p>
          <p className="text-3xl font-bold text-slate-900">{myListings.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Total Views</p>
          <p className="text-3xl font-bold text-slate-900">{myListings.reduce((sum, l) => sum + (l.views || 0), 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Inquiries</p>
          <p className="text-3xl font-bold text-emerald-600">{messages.filter(m => m.from !== currentUser.name).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Response Time</p>
          <p className="text-3xl font-bold text-slate-900">2h</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-500" /> Post Your Listing
          </h3>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newListing = {
              id: listings.length + 1,
              title: formData.get('title'),
              price: parseInt(formData.get('price')),
              beds: parseInt(formData.get('beds')),
              baths: parseInt(formData.get('baths')),
              sqft: parseInt(formData.get('sqft')),
              neighborhood: formData.get('neighborhood'),
              image: '🏠',
              seller: currentUser.name,
              sellerId: currentUser.id,
              photos: 0,
              daysSinceListed: 0,
              inquiries: 0,
              completeness: 60,
              priceGuidance: formData.get('neighborhood') === 'Belmont' ? '400-450k' : '300-400k',
              views: 0,
              verified: true,
              description: formData.get('description') || 'Beautiful home in Nashville.',
            };
            setListings([...listings, newListing]);
            setMyListings([...myListings, newListing]);
            e.target.reset();
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Property Title</label>
              <input type="text" name="title" placeholder="Beautiful home in Belmont" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Price</label>
                <input type="number" name="price" placeholder="425000" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Beds</label>
                <input type="number" name="beds" placeholder="3" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Baths</label>
                <input type="number" step="0.5" name="baths" placeholder="2.5" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sq Ft</label>
                <input type="number" name="sqft" placeholder="2100" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Neighborhood</label>
              <select name="neighborhood" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select...</option>
                <option>Belmont</option>
                <option>East Nashville</option>
                <option>Downtown</option>
                <option>Green Hills</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea name="description" placeholder="Describe your home..." rows="3" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
              <p className="text-xs text-slate-500 mt-1">At least 50 characters recommended</p>
            </div>

            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-semibold transition">
              Post Listing
            </button>
          </form>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>💡 Tip:</strong> Add at least 3 photos and a detailed description for 5x more interest.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Closing Checklist</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm">Post your listing</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Connect with photographers & stagers</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Receive & review offers</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Schedule home inspection</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Connect with closing attorney</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Schedule final walkthrough</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <span className="text-sm">Close transaction</span>
            </div>
          </div>

          <div className="bg-emerald-50 p-4 border border-emerald-200 rounded-lg">
            <p className="text-sm font-semibold text-emerald-900 mb-2">Next Step:</p>
            <p className="text-xs text-emerald-800 mb-3">Connect with professionals to prepare your home for sale.</p>
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-2 rounded-lg font-semibold transition">
              Browse Vendors
            </button>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Legal:</strong> We coordinate professionals. You choose which to work with. See our <button onClick={() => setCurrentPage('legal')} className="text-blue-600 hover:underline">legal terms</button>.
            </p>
          </div>
        </div>
      </div>

      {myListings.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Your Active Listings</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {myListings.map(listing => {
              const completeness = calculateListingCompleteness(listing);
              return (
                <div key={listing.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">{listing.title}</h4>
                      <p className="text-xl font-bold text-emerald-600">${(listing.price / 1000).toFixed(0)}k</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">{completeness}%</div>
                      <p className="text-xs text-slate-600">Complete</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <p>📊 Views: {listing.views}</p>
                    <p>💬 Inquiries: {listing.inquiries}</p>
                    <p>📅 Listed: {listing.daysSinceListed} days</p>
                  </div>

                  {completeness < 80 && (
                    <div className="bg-yellow-50 p-3 rounded mb-4 border border-yellow-200">
                      <p className="text-xs text-yellow-800"><strong>Incomplete Listing:</strong> Add more details and photos for better visibility.</p>
                    </div>
                  )}

                  <button className="w-full border border-slate-300 text-slate-700 hover:bg-slate-50 py-2 rounded-lg text-sm font-semibold transition">
                    Edit Listing
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // VENDOR DASHBOARD
  const VendorDashboard = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Vendor Dashboard</h2>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Profile Views</p>
          <p className="text-3xl font-bold text-slate-900">247</p>
          <p className="text-xs text-slate-500 mt-1">↑ 12% this week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">New Inquiries</p>
          <p className="text-3xl font-bold text-emerald-600">5</p>
          <p className="text-xs text-slate-500 mt-1">This week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Response Rate</p>
          <p className="text-3xl font-bold text-slate-900">100%</p>
          <p className="text-xs text-slate-500 mt-1">Avg: 2h response</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Rating</p>
          <p className="text-3xl font-bold text-amber-500">4.9★</p>
          <p className="text-xs text-slate-500 mt-1">32 reviews</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Your Profile Status</h3>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Email Verified</p>
                <p className="text-xs text-slate-600">photos@company.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Business License</p>
                <p className="text-xs text-slate-600">Verified</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Insurance</p>
                <p className="text-xs text-slate-600">$1M liability</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Phone Verified</p>
                <p className="text-xs text-slate-600">(615) 555-0101</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-semibold text-emerald-900">✓ Profile Complete</p>
            <p className="text-xs text-emerald-800 mt-1">You're eligible for featured placement and priority lead routing.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Recent Inquiries</h3>
          
          <div className="space-y-4">
            <div className="border-l-4 border-emerald-500 pl-4 py-3">
              <p className="font-semibold text-slate-900 text-sm">Sarah M. - Home Staging</p>
              <p className="text-xs text-slate-600">Preparing Craftsman home for sale</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">✓ Responded 2 hours ago</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-4 py-3">
              <p className="font-semibold text-slate-900 text-sm">John D. - Photography</p>
              <p className="text-xs text-slate-600">Professional photos needed for listing</p>
              <p className="text-xs text-orange-600 font-semibold mt-1">⏱ No response yet</p>
            </div>
            <div className="border-l-4 border-emerald-500 pl-4 py-3">
              <p className="font-semibold text-slate-900 text-sm">Alex J. - Home Inspection</p>
              <p className="text-xs text-slate-600">Schedule inspection for new purchase</p>
              <p className="text-xs text-emerald-600 font-semibold mt-1">✓ Appointment scheduled</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-8">
        <h3 className="text-lg font-semibold text-emerald-900 mb-3">Upgrade to Premium</h3>
        <p className="text-slate-700 mb-4">Get featured placement, unlimited leads, and priority routing for qualified buyers and sellers.</p>
        <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold transition">
          Upgrade Now - $99/month
        </button>
      </div>
    </div>
  );

  // ADMIN DASHBOARD
  const AdminDashboard = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Admin Dashboard</h2>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Active Listings</p>
          <p className="text-3xl font-bold text-slate-900">{listings.length}</p>
          <p className="text-xs text-emerald-600 mt-1">↑ +5 this week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Service Providers</p>
          <p className="text-3xl font-bold text-slate-900">{vendors.length}</p>
          <p className="text-xs text-emerald-600 mt-1">↑ +2 this week</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Monthly Revenue</p>
          <p className="text-3xl font-bold text-slate-900">${(analytics.monthlyRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-emerald-600 mt-1">↑ 12% vs last month</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-600 text-sm">Churn Rate</p>
          <p className="text-3xl font-bold text-slate-900">{analytics.churnRate}%</p>
          <p className="text-xs text-amber-600 mt-1">Target: &lt;3%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Key Metrics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Avg Response Time</span>
              <span className="font-semibold">{analytics.avgResponseTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">User Retention</span>
              <span className="font-semibold">{analytics.userRetention}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Platform Growth</span>
              <span className="font-semibold">{analytics.platformGrowth}% MoM</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Transactions Facilitated</span>
              <span className="font-semibold">{analytics.totalTransactions}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Vendor Health</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-red-900">2 vendors at risk</p>
                <p className="text-xs text-red-700">No activity &gt; 14 days</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded border border-yellow-200">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-yellow-900">5 vendors flagged</p>
                <p className="text-xs text-yellow-700">Rating &lt; 4.0 stars</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // LEGAL PAGE
  const LegalPage = () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Legal Terms & Disclaimer</h2>

      <div className="space-y-8 text-slate-700">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-900 mb-3">⚠️ Important Disclaimer</h3>
          <p className="text-sm text-red-800 mb-3">
            Nashville Direct is a <strong>marketplace platform only</strong>. We facilitate connections between buyers, sellers, and service professionals. We do NOT:
          </p>
          <ul className="text-sm text-red-800 space-y-2 ml-4 list-disc">
            <li>Practice real estate law or provide legal advice</li>
            <li>Hold earnest money, deposits, or down payments</li>
            <li>Facilitate closings or coordinate title transfers</li>
            <li>Act as a real estate broker or agent</li>
            <li>Guarantee transaction success or outcome</li>
            <li>Provide financial, legal, or real estate advice</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">What We Do</h3>
          <p>Nashville Direct connects buyers with homes for sale and sellers with buyers actively using our platform. All transactions, negotiations, and closings are handled independently by the parties involved or their chosen professionals.</p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Verification & Trust</h3>
          <p className="mb-3">We verify user identities and credentials to the best of our ability, but we do not guarantee accuracy. Users are responsible for conducting their own due diligence on all parties they transact with.</p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Professional Services</h3>
          <p>All service providers (photographers, inspectors, contractors, attorneys, etc.) are independent professionals. Nashville Direct does not guarantee service quality, availability, or outcome. Use your own judgment and check references.</p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Pricing & Commissions</h3>
          <p>Service provider subscriptions are separate from any real estate transactions. Sellers are not obligated to use any services found through our platform.</p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Liability</h3>
          <p>Nashville Direct is not responsible for disputes, failed transactions, misrepresentations, or any issues arising from connections made through our platform. All transactions occur at the parties' own risk.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <p className="text-sm text-blue-800">
            For questions about closings, legal requirements, or real estate transactions, consult with a licensed real estate attorney in your state.
          </p>
        </div>
      </div>

      <button onClick={() => setCurrentPage('home')} className="mt-8 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-semibold transition">
        Back to Home
      </button>
    </div>
  );

  // HELP & FAQ
  const HelpPage = () => (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Help & FAQ</h2>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-2">How do I post a listing?</h3>
          <p className="text-slate-700 text-sm">Sign up as a seller, complete the listing form with photos and description, and your home will appear on the marketplace immediately.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-2">How do I contact a seller or buyer?</h3>
          <p className="text-slate-700 text-sm">Click "Contact" on any listing or profile. Send a message and the user will be notified. All communication is logged for transparency.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-2">Are service providers verified?</h3>
          <p className="text-slate-700 text-sm">We verify email, phone, and basic credentials. However, you should still check references and reviews before hiring any professional.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-2">How much does it cost?</h3>
          <p className="text-slate-700 text-sm">Buyers and sellers post listings for FREE. Service providers can list for free (limited visibility) or upgrade to premium at $99/month for featured placement and unlimited leads.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-2">What happens after I find a buyer/seller?</h3>
          <p className="text-slate-700 text-sm">You negotiate directly. We provide a closing checklist and can connect you with attorneys, title companies, and inspectors. We don't participate in the closing.</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <p className="text-sm text-blue-800">
            Have other questions? Contact us at support@nashvilledirect.com
          </p>
        </div>
      </div>

      <button onClick={() => setCurrentPage('home')} className="mt-8 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-semibold transition">
        Back to Home
      </button>
    </div>
  );

  // RENDER
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        {!currentUser && currentPage === 'home' && <HomePage />}
        {!currentUser && currentPage === 'verification' && <VerificationFlow />}
        {!currentUser && currentPage === 'legal' && <LegalPage />}
        {!currentUser && currentPage === 'help' && <HelpPage />}
        
        {currentUser && userType === 'buyer' && currentPage === 'dashboard' && <BuyerDashboard />}
        {currentUser && userType === 'seller' && currentPage === 'dashboard' && <SellerDashboard />}
        {currentUser && userType === 'vendor' && currentPage === 'dashboard' && <VendorDashboard />}
        {currentUser && userType === 'admin' && currentPage === 'dashboard' && <AdminDashboard />}
      </main>

      <footer className="bg-slate-900 text-white mt-16 py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold mb-3">Nashville Direct</p>
              <p className="text-sm text-slate-400">Direct real estate marketplace for buyers, sellers, and professionals.</p>
            </div>
            <div>
              <p className="font-semibold mb-3">For Buyers</p>
              <p className="text-sm text-slate-400">Browse homes • Contact sellers • Find professionals</p>
            </div>
            <div>
              <p className="font-semibold mb-3">For Sellers</p>
              <p className="text-sm text-slate-400">Post listings • Connect with buyers • Coordinate closing</p>
            </div>
            <div>
              <p className="font-semibold mb-3">Legal</p>
              <button onClick={() => setCurrentPage('legal')} className="text-sm text-slate-400 hover:text-white">Terms & Disclaimer</button>
              <button onClick={() => setCurrentPage('help')} className="text-sm text-slate-400 hover:text-white block">Help & FAQ</button>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>© 2024 Nashville Direct. We connect buyers, sellers, and professionals. We do not practice real estate law or facilitate closings.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketplaceCompleteMVP;
