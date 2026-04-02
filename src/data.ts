export interface Store {
  id: string;
  name: string;
  address: string;
  distance: number; // in km
  currentDistance?: number; // Calculated real-time distance
  usimStock: number;
  waitingCount: number;
  lat: number;
  lng: number;
  phoneNumber: string;
  businessHours: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: string;
}

export const MOCK_STORES: Store[] = [
  {
    id: "1",
    name: "LG유플러스 강남직영점",
    address: "서울특별시 강남구 강남대로 438",
    distance: 0.5,
    usimStock: 150,
    waitingCount: 12,
    lat: 37.5006,
    lng: 127.0271,
    phoneNumber: "070-4000-1234",
    businessHours: "10:00 - 20:00",
  },
  {
    id: "2",
    name: "LG유플러스 홍대입구역점",
    address: "서울특별시 마포구 양화로 161",
    distance: 4.2,
    usimStock: 45,
    waitingCount: 25,
    lat: 37.5575,
    lng: 126.9245,
    phoneNumber: "070-4000-5678",
    businessHours: "10:00 - 21:00",
  },
  {
    id: "3",
    name: "LG유플러스 삼성역점",
    address: "서울특별시 강남구 테헤란로 521",
    distance: 2.1,
    usimStock: 0,
    waitingCount: 5,
    lat: 37.5088,
    lng: 127.0631,
    phoneNumber: "070-4000-9012",
    businessHours: "10:00 - 20:00",
  },
  {
    id: "4",
    name: "LG유플러스 여의도점",
    address: "서울특별시 영등포구 여의나루로 67",
    distance: 6.8,
    usimStock: 200,
    waitingCount: 2,
    lat: 37.5215,
    lng: 126.9243,
    phoneNumber: "070-4000-3456",
    businessHours: "10:00 - 19:00",
  },
  {
    id: "5",
    name: "LG유플러스 잠실역점",
    address: "서울특별시 송파구 올림픽로 265",
    distance: 5.5,
    usimStock: 12,
    waitingCount: 18,
    lat: 37.5133,
    lng: 127.1001,
    phoneNumber: "070-4000-7890",
    businessHours: "10:30 - 20:30",
  },
  {
    id: "6",
    name: "LG유플러스 광화문점",
    address: "서울특별시 종로구 세종대로 149",
    distance: 8.2,
    usimStock: 88,
    waitingCount: 7,
    lat: 37.5704,
    lng: 126.9768,
    phoneNumber: "070-4000-1111",
    businessHours: "09:30 - 19:30",
  },
];
