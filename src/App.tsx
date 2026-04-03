import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Phone, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Navigation,
  RefreshCw,
  Info,
  LocateFixed,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ArrowLeft,
  FileUp,
  Download,
  LogOut,
  LogIn,
  Map as MapIcon,
  List as ListIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Store, Notice } from './data';
import { calculateDistance } from './utils';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  User,
  OperationType,
  handleFirestoreError
} from './firebase';

import GoogleMapReact from 'google-map-react';

type ViewMode = 'customer' | 'admin';
type CustomerView = 'list' | 'map' | 'notice';

const Marker = ({ text, stockStatus, onClick }: { text: string; stockStatus: string; lat: number; lng: number; onClick: () => void }) => (
  <div 
    className="relative flex flex-col items-center -translate-x-1/2 -translate-y-full cursor-pointer group"
    onClick={onClick}
  >
    <div className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white shadow-lg whitespace-nowrap mb-1 transition-transform group-hover:scale-110 ${
      stockStatus === '여유' ? 'bg-green-500' : stockStatus === '보통' ? 'bg-orange-500' : 'bg-red-500'
    }`}>
      {text}
    </div>
    <div className={`w-3 h-3 rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-110 ${
      stockStatus === '여유' ? 'bg-green-500' : stockStatus === '보통' ? 'bg-orange-500' : 'bg-red-500'
    }`} />
  </div>
);

const UserMarker = ({ lat, lng }: { lat: number; lng: number }) => (
  <div
    className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10 -translate-x-1/2 -translate-y-1/2"
  />
);

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('customer');
  const [customerView, setCustomerView] = useState<CustomerView>('list');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [stores, setStores] = useState<Store[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'inStock' | 'lowWaiting'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Admin State
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [newStore, setNewStore] = useState<Partial<Store>>({
    name: '',
    address: '',
    usimStock: 0,
    waitingCount: 0,
    lat: 37.5,
    lng: 127.0,
    phoneNumber: '',
    businessHours: '10:00 - 20:00',
    distance: 0
  });

  // Admin Notice State
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [isAddingNotice, setIsAddingNotice] = useState(false);
  const [newNotice, setNewNotice] = useState<Partial<Notice>>({
    title: '',
    content: ''
  });
  const [adminTab, setAdminTab] = useState<'stores' | 'notices'>('stores');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'stores'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storesData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as Store[];
      setStores(storesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores');
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;

    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const noticesData = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as Notice[];
      setNotices(noticesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notices');
    });

    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            setLocationError(null);
          },
          (error) => {
            console.error("Geolocation error:", error);
            setLocationError("위치 정보를 가져올 수 없습니다.");
            setUserLocation({ lat: 37.4979, lng: 127.0276 });
          }
        );
      } else {
        setLocationError("이 브라우저는 위치 정보를 지원하지 않습니다.");
        setUserLocation({ lat: 37.4979, lng: 127.0276 });
      }
    };

    getLocation();
  }, []);

  const storesWithDistance = useMemo(() => {
    if (!userLocation) return stores;

    return stores.map(store => ({
      ...store,
      currentDistance: calculateDistance(
        userLocation.lat,
        userLocation.lng,
        store.lat,
        store.lng
      )
    }));
  }, [userLocation, stores]);

  const filteredStores = useMemo(() => {
    return storesWithDistance.filter(store => {
      const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           store.address.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      if (filter === 'inStock') return store.usimStock > 0;
      if (filter === 'lowWaiting') return store.waitingCount < 10;
      return true;
    }).sort((a, b) => (a.currentDistance || 0) - (b.currentDistance || 0));
  }, [searchQuery, filter, storesWithDistance]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStockStatus = (stock: number) => {
    if (stock > 50) return { label: '여유', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
    if (stock > 0) return { label: '보통', color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertCircle };
    return { label: '품절', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle };
  };

  const getWaitStatus = (count: number) => {
    if (count < 5) return { label: '원활', color: 'text-green-600' };
    if (count < 15) return { label: '보통', color: 'text-orange-600' };
    return { label: '혼잡', color: 'text-red-600' };
  };

  // Auth Actions
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setViewMode('customer');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Admin Actions
  const handleSaveStore = async () => {
    if (isAddingStore) {
      const id = Math.random().toString(36).substr(2, 9);
      const storeToAdd = { ...newStore, id } as Store;
      try {
        await setDoc(doc(db, 'stores', id), storeToAdd);
        setIsAddingStore(false);
        setNewStore({
          name: '',
          address: '',
          usimStock: 0,
          waitingCount: 0,
          lat: 37.5,
          lng: 127.0,
          phoneNumber: '',
          businessHours: '10:00 - 20:00',
          distance: 0
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `stores/${id}`);
      }
    } else if (editingStore) {
      try {
        await setDoc(doc(db, 'stores', editingStore.id), editingStore);
        setEditingStore(null);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `stores/${editingStore.id}`);
      }
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (window.confirm('정말 이 매장을 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'stores', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `stores/${id}`);
      }
    }
  };

  const handleSaveNotice = async () => {
    if (!newNotice.title || !newNotice.content) return;
    
    const noticeId = editingNotice?.id || Date.now().toString();
    const noticeData = {
      ...newNotice,
      id: noticeId,
      createdAt: editingNotice?.createdAt || new Date().toISOString(),
      author: user?.email || 'Admin'
    } as Notice;

    try {
      await setDoc(doc(db, 'notices', noticeId), noticeData);
      setIsAddingNotice(false);
      setEditingNotice(null);
      setNewNotice({ title: '', content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notices');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'notices', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'notices');
      }
    }
  };

  const handleQuickUpdate = async (id: string, field: 'usimStock' | 'waitingCount', value: number) => {
    try {
      await updateDoc(doc(db, 'stores', id), { [field]: value });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `stores/${id}`);
    }
  };

  const handleAddressBlur = async (address: string) => {
    if (!address || address.length < 5) return;
    
    setIsGeocoding(true);
    try {
      const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("Google Maps API Key is missing for geocoding");
        return;
      }
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status === 'OK' && data.results[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        if (isAddingStore) {
          setNewStore(prev => ({ ...prev, lat, lng }));
        } else if (editingStore) {
          setEditingStore(prev => prev ? { ...prev, lat, lng } : null);
        }
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const newStoresFromExcel: Store[] = jsonData.map((row, index) => {
        const latVal = parseFloat(row['lat'] || row['위도']);
        const lngVal = parseFloat(row['lng'] || row['경도']);
        
        return {
          id: `excel-${Date.now()}-${index}`,
          name: String(row['매장명'] || row['name'] || '새 매장'),
          address: String(row['주소'] || row['address'] || ''),
          businessHours: String(row['영업시간'] || row['businessHours'] || '10:00 - 20:00'),
          phoneNumber: String(row['전화번호'] || row['phoneNumber'] || ''),
          usimStock: parseInt(row['유심 재고'] || row['usimStock']) || 0,
          waitingCount: parseInt(row['대기 고객'] || row['waitingCount']) || 0,
          lat: isNaN(latVal) ? 37.5 : latVal,
          lng: isNaN(lngVal) ? 127.0 : lngVal,
          distance: 0
        };
      });

      if (newStoresFromExcel.length > 0) {
        if (window.confirm(`${newStoresFromExcel.length}개의 매장 데이터를 추가하시겠습니까?\n(위도/경도가 없는 매장은 주소를 기반으로 자동 좌표 변환을 시도합니다.)`)) {
          try {
            let successCount = 0;
            const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

            for (const store of newStoresFromExcel) {
              let finalStore = { ...store };

              // If lat/lng is missing or 0, try to geocode the address
              if ((!store.lat || !store.lng || store.lat === 0 || store.lng === 0) && store.address && apiKey) {
                try {
                  const response = await fetch(
                    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(store.address)}&key=${apiKey}`
                  );
                  const data = await response.json();
                  
                  if (data.status === 'OK' && data.results[0]) {
                    const { lat, lng } = data.results[0].geometry.location;
                    finalStore.lat = lat;
                    finalStore.lng = lng;
                  }
                } catch (geoError) {
                  console.error(`Geocoding failed for store: ${store.name}`, geoError);
                }
              }

              await setDoc(doc(db, 'stores', finalStore.id), finalStore);
              successCount++;
            }
            alert(`${successCount}개의 매장이 성공적으로 업로드되었습니다.`);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'stores/bulk');
          }
        }
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = '';
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      {
        '매장명': '샘플 매장',
        '주소': '서울특별시 강남구 테헤란로 123',
        '영업시간': '10:00 - 20:00',
        '전화번호': '02-1234-5678',
        '유심 재고': 100,
        '대기 고객': 5,
        '위도': 37.5012,
        '경도': 127.0396
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "매장목록");
    XLSX.writeFile(workbook, "uplus_stores_sample.xlsx");
  };

  const handleStoreClick = (store: Store) => {
    setMapCenter({ lat: store.lat, lng: store.lng });
    setMapZoom(16);
    setCustomerView('map');
  };

  const openExternalMap = (store: Store) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`;
    window.open(url, '_blank');
  };

  if (viewMode === 'admin') {
    if (!user) {
      return (
        <div className="min-h-screen bg-gray-100 font-sans flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <div className="w-16 h-16 bg-uplus-pink/10 text-uplus-pink rounded-full flex items-center justify-center mx-auto mb-6">
              <Settings size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">관리자 로그인</h2>
            <p className="text-gray-500 mb-8">매장 관리를 위해 관리자 계정으로 로그인해 주세요.</p>
            <button 
              onClick={handleLogin}
              className="w-full bg-uplus-pink text-white py-4 rounded-2xl font-bold hover:bg-uplus-magenta transition-all flex items-center justify-center gap-3 shadow-lg shadow-uplus-pink/20"
            >
              <LogIn size={20} />
              Google 계정으로 로그인
            </button>
            <button 
              onClick={() => setViewMode('customer')}
              className="mt-4 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100 font-sans pb-20">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setViewMode('customer')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <h1 className="font-bold text-lg tracking-tight">관리 시스템</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="로그아웃"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
          <div className="max-w-4xl mx-auto px-4 flex border-t border-gray-100">
            <button 
              onClick={() => setAdminTab('stores')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${adminTab === 'stores' ? 'border-uplus-pink text-uplus-pink' : 'border-transparent text-gray-400'}`}
            >
              매장 관리
            </button>
            <button 
              onClick={() => setAdminTab('notices')}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${adminTab === 'notices' ? 'border-uplus-pink text-uplus-pink' : 'border-transparent text-gray-400'}`}
            >
              공지사항 관리
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 pt-6">
          {adminTab === 'stores' ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold">매장 목록</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={downloadSampleExcel}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                    title="샘플 엑셀 다운로드"
                  >
                    <Download size={18} />
                    샘플
                  </button>
                  <button 
                    onClick={() => {
                      const dataToExport = stores.map(store => ({
                        '매장명': store.name,
                        '주소': store.address,
                        '영업시간': store.businessHours,
                        '전화번호': store.phoneNumber,
                        '유심 재고': store.usimStock,
                        '대기 고객': store.waitingCount,
                        '위도': store.lat,
                        '경도': store.lng
                      }));
                      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, "매장현황");
                      XLSX.writeFile(workbook, `uplus_stores_status_${new Date().toISOString().split('T')[0]}.xlsx`);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                    title="현재 매장 현황 다운로드"
                  >
                    <Download size={18} />
                    전체 다운로드
                  </button>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                    <FileUp size={18} />
                    <span className="hidden sm:inline">엑셀 업로드</span>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                  </label>
                  <button 
                    onClick={() => setIsAddingStore(true)}
                    className="bg-uplus-pink text-white p-2 sm:px-4 sm:py-2 rounded-xl hover:bg-uplus-magenta transition-colors flex items-center gap-2 font-bold text-sm"
                  >
                    <Plus size={20} />
                    <span className="hidden sm:inline">매장 추가</span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">매장명 / 주소</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">영업시간</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">전화번호</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">유심 재고</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">대기 고객</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {stores.map(store => (
                      <tr key={store.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{store.name}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 max-w-[200px] truncate">{store.address}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{store.businessHours}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{store.phoneNumber}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-uplus-pink/20 outline-none font-medium"
                              value={store.usimStock}
                              onChange={(e) => handleQuickUpdate(store.id, 'usimStock', parseInt(e.target.value) || 0)}
                            />
                            <span className="text-xs text-gray-400">개</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-uplus-pink/20 outline-none font-medium"
                              value={store.waitingCount}
                              onChange={(e) => handleQuickUpdate(store.id, 'waitingCount', parseInt(e.target.value) || 0)}
                            />
                            <span className="text-xs text-gray-400">명</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => setEditingStore(store)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {stores.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  등록된 매장이 없습니다. 매장을 추가하거나 엑셀로 업로드해 주세요.
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold">공지사항 목록</h2>
                <button 
                  onClick={() => {
                    setEditingNotice(null);
                    setNewNotice({ title: '', content: '' });
                    setIsAddingNotice(true);
                  }}
                  className="bg-uplus-pink text-white px-4 py-2 rounded-xl hover:bg-uplus-magenta transition-colors flex items-center gap-2 font-bold text-sm"
                >
                  <Plus size={20} />
                  공지 추가
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">제목</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">작성일</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {notices.map(notice => (
                      <tr key={notice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{notice.title}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{notice.content}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(notice.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <button 
                              onClick={() => {
                                setEditingNotice(notice);
                                setNewNotice(notice);
                                setIsAddingNotice(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteNotice(notice.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {notices.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  등록된 공지사항이 없습니다.
                </div>
              )}
            </div>
          )}
        </main>

        {/* Edit Store Modal */}
        <AnimatePresence>
          {(editingStore || isAddingStore) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setEditingStore(null); setIsAddingStore(false); }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">{isAddingStore ? '새 매장 추가' : '매장 정보 수정'}</h2>
                  <button onClick={() => { setEditingStore(null); setIsAddingStore(false); }} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">매장명</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none"
                      value={isAddingStore ? newStore.name : editingStore?.name}
                      onChange={(e) => isAddingStore ? setNewStore({...newStore, name: e.target.value}) : setEditingStore({...editingStore!, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">주소</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none"
                      value={isAddingStore ? newStore.address : editingStore?.address}
                      onChange={(e) => isAddingStore ? setNewStore({...newStore, address: e.target.value}) : setEditingStore({...editingStore!, address: e.target.value})}
                      onBlur={(e) => handleAddressBlur(e.target.value)}
                      placeholder="주소를 입력하면 위도/경도가 자동 입력됩니다"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">전화번호</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none"
                        value={isAddingStore ? newStore.phoneNumber : editingStore?.phoneNumber}
                        onChange={(e) => isAddingStore ? setNewStore({...newStore, phoneNumber: e.target.value}) : setEditingStore({...editingStore!, phoneNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">영업시간</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none"
                        value={isAddingStore ? newStore.businessHours : editingStore?.businessHours}
                        onChange={(e) => isAddingStore ? setNewStore({...newStore, businessHours: e.target.value}) : setEditingStore({...editingStore!, businessHours: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 mb-1">위도 (Lat)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className={`w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none transition-opacity ${isGeocoding ? 'opacity-50' : ''}`}
                        value={isAddingStore ? newStore.lat : editingStore?.lat}
                        onChange={(e) => isAddingStore ? setNewStore({...newStore, lat: parseFloat(e.target.value)}) : setEditingStore({...editingStore!, lat: parseFloat(e.target.value)})}
                        disabled={isGeocoding}
                      />
                      {isGeocoding && (
                        <div className="absolute right-3 bottom-3 animate-spin text-uplus-pink">
                          <RefreshCw size={14} />
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 mb-1">경도 (Lng)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        className={`w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none transition-opacity ${isGeocoding ? 'opacity-50' : ''}`}
                        value={isAddingStore ? newStore.lng : editingStore?.lng}
                        onChange={(e) => isAddingStore ? setNewStore({...newStore, lng: parseFloat(e.target.value)}) : setEditingStore({...editingStore!, lng: parseFloat(e.target.value)})}
                        disabled={isGeocoding}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handleSaveStore}
                  className="w-full bg-uplus-pink text-white py-4 rounded-2xl font-bold mt-8 shadow-lg shadow-uplus-pink/20 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  저장하기
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Notice Modal */}
        <AnimatePresence>
          {(editingNotice || isAddingNotice) && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setEditingNotice(null); setIsAddingNotice(false); }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">{isAddingNotice ? '새 공지사항 추가' : '공지사항 수정'}</h2>
                  <button onClick={() => { setEditingNotice(null); setIsAddingNotice(false); }} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">제목</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none"
                      value={isAddingNotice ? newNotice.title : editingNotice?.title}
                      onChange={(e) => isAddingNotice ? setNewNotice({...newNotice, title: e.target.value}) : setEditingNotice({...editingNotice!, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">내용</label>
                    <textarea 
                      rows={8}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-uplus-pink/20 outline-none resize-none"
                      value={isAddingNotice ? newNotice.content : editingNotice?.content}
                      onChange={(e) => isAddingNotice ? setNewNotice({...newNotice, content: e.target.value}) : setEditingNotice({...editingNotice!, content: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSaveNotice}
                  className="w-full bg-uplus-pink text-white py-4 rounded-2xl font-bold mt-8 shadow-lg shadow-uplus-pink/20 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  저장하기
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-uplus-pink rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">U+</span>
            </div>
            <h1 className="font-bold text-lg tracking-tight">유심 현황 조회</h1>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setCustomerView(customerView === 'list' ? 'map' : 'list')}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title={customerView === 'list' ? '지도 보기' : '목록 보기'}
            >
              {customerView === 'list' ? <MapIcon size={20} className="text-gray-600" /> : <ListIcon size={20} className="text-gray-600" />}
            </button>
            <button 
              onClick={handleRefresh}
              className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={20} className="text-gray-600" />
            </button>
            {user ? (
              <button 
                onClick={handleLogout}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="로그아웃"
              >
                <LogOut size={20} className="text-gray-600" />
              </button>
            ) : (
              <button 
                onClick={handleLogin}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="로그인"
              >
                <LogIn size={20} className="text-gray-600" />
              </button>
            )}
            <button 
              onClick={() => setViewMode('admin')}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <Settings size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6">
        {customerView === 'list' ? (
          <>
            {/* Banner */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-uplus-magenta rounded-2xl p-5 text-white mb-6 shadow-lg shadow-uplus-magenta/20"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-bold text-xl leading-tight">
                  전 고객 대상<br />유심 업데이트 안내
                </h2>
                <Info size={20} className="opacity-80" />
              </div>
              <p className="text-sm opacity-90 mb-4">
                보다 안전한 통신 생활을 위해 가까운 매장에서 유심 업데이트 또는 교체를 진행해 주세요.
              </p>
              <div className="flex gap-2">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">무료 교체</span>
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">당일 완료</span>
              </div>
            </motion.div>

            {/* Search & Filter */}
            <div className="space-y-4 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="매장명 또는 주소 검색"
                  className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-uplus-pink/20 focus:border-uplus-pink transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button 
                  onClick={() => setFilter('all')}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                  전체
                </button>
                <button 
                  onClick={() => setFilter('inStock')}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'inStock' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                  재고 있음
                </button>
                <button 
                  onClick={() => setFilter('lowWaiting')}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'lowWaiting' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                >
                  대기 적음
                </button>
              </div>
            </div>

            {/* Store List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-gray-500 font-medium">검색 결과 {filteredStores.length}건</p>
                <div className="flex items-center gap-1 text-xs text-uplus-pink font-semibold">
                  {locationError ? (
                    <span className="text-red-500">{locationError}</span>
                  ) : (
                    <>
                      <LocateFixed size={12} />
                      <span>실시간 위치 기준 정렬</span>
                    </>
                  )}
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {filteredStores.map((store, index) => {
                  const stock = getStockStatus(store.usimStock);
                  const wait = getWaitStatus(store.waitingCount);
                  const StockIcon = stock.icon;

                  return (
                    <motion.div
                      key={store.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group cursor-pointer"
                      onClick={() => handleStoreClick(store)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 group-hover:text-uplus-pink transition-colors">{store.name}</h3>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin size={12} />
                            {store.address} · <span className="text-uplus-pink font-semibold">{store.currentDistance}km</span>
                          </p>
                        </div>
                        <ChevronRight size={20} className="text-gray-300 group-hover:text-uplus-pink transition-colors" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className={`${stock.bg} rounded-xl p-3 flex flex-col items-center justify-center text-center`}>
                          <span className="text-[10px] text-gray-500 font-medium mb-1">유심 재고</span>
                          <div className={`flex items-center gap-1 font-bold ${stock.color}`}>
                            <StockIcon size={14} />
                            {stock.label}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-0.5">{store.usimStock}개 보유</span>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] text-gray-500 font-medium mb-1">현재 대기</span>
                          <div className={`flex items-center gap-1 font-bold ${wait.color}`}>
                            {store.waitingCount}명
                          </div>
                          <span className="text-[10px] text-gray-400 mt-0.5">예상 {store.waitingCount * 5}분</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Clock size={14} className="text-gray-400" />
                          {store.businessHours}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Phone size={14} className="text-gray-400" />
                          {store.phoneNumber}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredStores.length === 0 && (
                <div className="py-20 text-center">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">검색 결과가 없습니다.</p>
                  <p className="text-sm text-gray-400 mt-1">다른 검색어를 입력해 보세요.</p>
                </div>
              )}
            </div>
          </>
        ) : customerView === 'map' ? (
          <div className="h-[calc(100vh-220px)] w-full rounded-3xl overflow-hidden shadow-xl border border-gray-200 relative bg-gray-100">
            <GoogleMapReact
              bootstrapURLKeys={{ key: (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '' }}
              defaultCenter={userLocation || { lat: 37.5665, lng: 126.9780 }}
              defaultZoom={13}
              center={mapCenter || userLocation || undefined}
              zoom={mapZoom}
              onChange={({ center, zoom }) => {
                setMapCenter(center);
                setMapZoom(zoom);
              }}
            >
              {filteredStores.map(store => (
                <Marker
                  key={store.id}
                  lat={store.lat}
                  lng={store.lng}
                  text={store.name}
                  stockStatus={getStockStatus(store.usimStock).label}
                  onClick={() => openExternalMap(store)}
                />
              ))}
              {userLocation && (
                <UserMarker
                  lat={userLocation.lat}
                  lng={userLocation.lng}
                />
              )}
            </GoogleMapReact>
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-100">
              <p className="text-xs font-bold text-gray-900 mb-1">지도에서 매장 찾기</p>
              <p className="text-[10px] text-gray-500">마커를 통해 주변 매장의 위치와 재고 상태를 한눈에 확인할 수 있습니다.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">공지사항</h2>
            <div className="space-y-4">
              {notices.map((notice, index) => (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-gray-900">{notice.title}</h3>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                      {new Date(notice.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {notice.content}
                  </p>
                </motion.div>
              ))}
              {notices.length === 0 && (
                <div className="py-20 text-center text-gray-400">
                  등록된 공지사항이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation (Simulated) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-10 py-3 flex justify-around items-center max-w-md mx-auto z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setCustomerView('list')}
          className={`flex flex-col items-center gap-1 ${customerView === 'list' ? 'text-uplus-pink' : 'text-gray-400'}`}
        >
          <MapPin size={20} />
          <span className="text-[10px] font-bold">매장찾기</span>
        </button>
        <button 
          onClick={() => setCustomerView('map')}
          className={`flex flex-col items-center gap-1 ${customerView === 'map' ? 'text-uplus-pink' : 'text-gray-400'}`}
        >
          <MapIcon size={20} />
          <span className="text-[10px] font-medium">지도보기</span>
        </button>
        <button 
          onClick={() => setCustomerView('notice')}
          className={`flex flex-col items-center gap-1 ${customerView === 'notice' ? 'text-uplus-pink' : 'text-gray-400'}`}
        >
          <AlertCircle size={20} />
          <span className="text-[10px] font-medium">공지사항</span>
        </button>
      </nav>
    </div>
  );
}
