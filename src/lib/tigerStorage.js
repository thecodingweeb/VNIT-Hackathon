import { supabase } from './supabase';

export const INITIAL_TIGERS = [
  {
    id: 'PTR-T-001', sex: 'Male', status: 'active',
    zone: 'Core', captures: 148, lastSeen: 'Today', confidence: 97.2,
    image: '/images/tiger_hero.jpg', age: '6–8 yrs',
    firstCaptured: '12 Jan 2024', lastCaptured: '17 Aug 2026',
    stations: 13, range: '42.6 km²', core: '11.8 km²',
    identityConf: 94.8, model: 'Siamese-CNN v1.2', verified: true,
    leftFlank: '/images/tiger_hero.jpg', rightFlank: '/images/tiger_2.jpg',
    captures_list: [
      { station: 'ST-42', date: '17 Aug 2026, 14:32', confidence: 94.8 },
      { station: 'ST-18', date: '12 Aug 2026, 11:11', confidence: 91.2 },
      { station: 'ST-37', date: '08 Aug 2026, 10:05', confidence: 87.6 },
    ]
  },
  {
    id: 'PTR-T-007', sex: 'Male', status: 'active',
    zone: 'Core', captures: 96, lastSeen: 'Yesterday', confidence: 91.2,
    image: '/images/tiger_2.jpg', age: '5–7 yrs',
    firstCaptured: '03 Mar 2024', lastCaptured: '16 Aug 2026',
    stations: 9, range: '38.1 km²', core: '9.4 km²',
    identityConf: 91.2, model: 'Siamese-CNN v1.2', verified: true,
    leftFlank: '/images/tiger_2.jpg', rightFlank: '/images/tiger_hero.jpg',
    captures_list: [
      { station: 'ST-16', date: '16 Aug 2026, 09:45', confidence: 91.2 },
      { station: 'ST-22', date: '10 Aug 2026, 17:30', confidence: 88.4 },
    ]
  },
  {
    id: 'PTR-T-021', sex: 'Female', status: 'provisional',
    zone: 'Buffer', captures: 41, lastSeen: '2 days ago', confidence: 72.4,
    image: '/images/tiger_3.jpg', age: '3–5 yrs',
    firstCaptured: '19 Jun 2025', lastCaptured: '15 Aug 2026',
    stations: 5, range: '22.3 km²', core: '5.1 km²',
    identityConf: 72.4, model: 'Siamese-CNN v1.2', verified: false,
    leftFlank: '/images/tiger_3.jpg', rightFlank: '/images/tiger_2.jpg',
    captures_list: [
      { station: 'ST-09', date: '15 Aug 2026, 09:12', confidence: 72.4 },
    ]
  },
  {
    id: 'PTR-T-041', sex: 'Male', status: 'active',
    zone: 'Core', captures: 184, lastSeen: '3 days ago', confidence: 88.3,
    image: '/images/tiger_4.jpg', age: '8–10 yrs',
    firstCaptured: '07 Nov 2023', lastCaptured: '14 Aug 2026',
    stations: 17, range: '55.2 km²', core: '14.2 km²',
    identityConf: 88.3, model: 'Siamese-CNN v1.2', verified: true,
    leftFlank: '/images/tiger_hero.jpg', rightFlank: '/images/tiger_4.jpg',
    captures_list: [
      { station: 'ST-12', date: '14 Aug 2026, 06:20', confidence: 88.3 },
      { station: 'ST-07', date: '11 Aug 2026, 20:14', confidence: 85.1 },
    ]
  },
  {
    id: 'PTR-T-095', sex: 'Female', status: 'active',
    zone: 'Buffer', captures: 73, lastSeen: '9 days ago', confidence: 79.1,
    image: '/images/tiger_5.jpg', age: '4–6 yrs',
    firstCaptured: '22 Feb 2025', lastCaptured: '08 Aug 2026',
    stations: 7, range: '28.9 km²', core: '6.8 km²',
    identityConf: 79.1, model: 'Siamese-CNN v1.2', verified: false,
    leftFlank: '/images/tiger_2.jpg', rightFlank: '/images/tiger_5.jpg',
    captures_list: [
      { station: 'ST-33', date: '08 Aug 2026, 21:55', confidence: 79.1 },
    ]
  },
  {
    id: 'PTR-T-003', sex: 'Male', status: 'absent',
    zone: 'Core', captures: 130, lastSeen: '16 days ago', confidence: 65.2,
    image: '/images/tiger_hero.jpg', age: '7–9 yrs',
    firstCaptured: '14 Sep 2023', lastCaptured: '01 Aug 2026',
    stations: 11, range: '47.8 km²', core: '12.1 km²',
    identityConf: 65.2, model: 'Siamese-CNN v1.2', verified: true,
    leftFlank: '/images/tiger_hero.jpg', rightFlank: '/images/tiger_3.jpg',
    captures_list: []
  },
  {
    id: 'PTR-T-002', sex: 'Male', status: 'absent',
    zone: 'Buffer', captures: 28, lastSeen: '18 days ago', confidence: 58.4,
    image: '/images/tiger_2.jpg', age: '2–4 yrs',
    firstCaptured: '05 Jan 2026', lastCaptured: '30 Jul 2026',
    stations: 4, range: '15.6 km²', core: '3.2 km²',
    identityConf: 58.4, model: 'Siamese-CNN v1.2', verified: false,
    leftFlank: '/images/tiger_2.jpg', rightFlank: '/images/tiger_hero.jpg',
    captures_list: []
  },
];

const STORAGE_KEY = 'tigerwatch_enrolled_tigers_persistent';

/**
 * Get all stored tigers (merging persistent localStorage with initial catalogue)
 */
export function getStoredTigers() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TIGERS));
      return INITIAL_TIGERS;
    }
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return INITIAL_TIGERS;
  } catch (err) {
    console.warn('Failed to parse stored tigers:', err);
    return INITIAL_TIGERS;
  }
}

/**
 * Save and persist a new tiger across logout, login, and refresh
 */
export async function saveTiger(newTiger) {
  const current = getStoredTigers();
  const existingIdx = current.findIndex(t => t.id === newTiger.id);

  let updated;
  if (existingIdx >= 0) {
    updated = current.map((t, idx) => idx === existingIdx ? { ...t, ...newTiger } : t);
  } else {
    updated = [newTiger, ...current];
  }

  // 1. Permanent Local Storage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  // 2. Sync with Supabase if online
  if (supabase) {
    try {
      await supabase.from('individuals').upsert({
        tiger_id: newTiger.id,
        sex: (newTiger.sex || 'unknown').toLowerCase(),
        status: newTiger.status || 'active',
        total_captures: newTiger.captures || 1,
        range_area_sqkm: parseFloat(String(newTiger.range || '0').replace(' km²', '')) || null,
        metadata: {
          zone: newTiger.zone,
          age: newTiger.age,
          image: newTiger.image,
          leftFlank: newTiger.leftFlank,
          rightFlank: newTiger.rightFlank
        }
      }, { onConflict: 'tiger_id' });
    } catch (err) {
      console.warn('Supabase tiger sync notice:', err.message);
    }
  }

  return updated;
}
