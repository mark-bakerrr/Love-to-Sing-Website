#!/usr/bin/env node
/**
 * Generates assets/santa-route.json for the Christmas countdown / Santa tracker.
 *
 * Times are stored as OFFSETS (seconds) from Santa's departure instant, not
 * absolute dates, so the route works every year without regeneration — the
 * section's "year" setting decides the actual departure (24 Dec 10:00 UTC).
 *
 * Route shape: Santa leaves the North Pole, makes first landfall just west of
 * the International Date Line (Kiritimati, Samoa, Tonga... then New Zealand —
 * Love to Sing's home turf gets a generous tour), then follows midnight
 * westward around the globe and returns to the North Pole ~25 hours later.
 *
 * Usage: node scripts/generate-santa-route.js
 */

const fs = require('fs');
const path = require('path');

const TOTAL_DURATION = 25 * 3600; // seconds Santa is airborne (24 Dec 10:00 UTC -> 25 Dec 11:00 UTC)
const TOTAL_PRESENTS = 7_800_000_000;

// [city, region, lat, lng, popWeight (≈ population in millions, sets presents share + stopover length)]
const STOPS = [
  ['North Pole', 'Santa’s Village', 84.6, 168.0, 0],
  // — International Date Line / Pacific —
  ['Kiritimati', 'Kiribati', 1.87, -157.43, 0.01],
  ['Apia', 'Samoa', -13.83, -171.76, 0.04],
  ['Nukuʻalofa', 'Tonga', -21.14, -175.2, 0.03],
  // — Aotearoa New Zealand (Santa always visits us first!) —
  ['Auckland', 'New Zealand', -36.85, 174.76, 1.7],
  ['Hamilton', 'New Zealand', -37.79, 175.28, 0.25],
  ['Tauranga', 'New Zealand', -37.69, 176.17, 0.16],
  ['Wellington', 'New Zealand', -41.29, 174.78, 0.42],
  ['Christchurch', 'New Zealand', -43.53, 172.64, 0.4],
  ['Queenstown', 'New Zealand', -45.03, 168.66, 0.05],
  ['Dunedin', 'New Zealand', -45.87, 170.5, 0.13],
  // — Pacific Islands & far-east Russia —
  ['Suva', 'Fiji', -18.14, 178.44, 0.2],
  ['Port Vila', 'Vanuatu', -17.73, 168.32, 0.05],
  ['Honiara', 'Solomon Islands', -9.43, 159.96, 0.08],
  ['Nouméa', 'New Caledonia', -22.28, 166.46, 0.1],
  ['Anadyr', 'Russia', 64.73, 177.51, 0.01],
  ['Petropavlovsk-Kamchatsky', 'Russia', 53.02, 158.65, 0.18],
  // — Australia & Papua New Guinea —
  ['Port Moresby', 'Papua New Guinea', -9.44, 147.18, 0.4],
  ['Cairns', 'Australia', -16.92, 145.77, 0.15],
  ['Brisbane', 'Australia', -27.47, 153.03, 2.6],
  ['Sydney', 'Australia', -33.87, 151.21, 5.3],
  ['Canberra', 'Australia', -35.28, 149.13, 0.46],
  ['Melbourne', 'Australia', -37.81, 144.96, 5.2],
  ['Hobart', 'Australia', -42.88, 147.33, 0.25],
  ['Adelaide', 'Australia', -34.93, 138.6, 1.4],
  ['Alice Springs', 'Australia', -23.7, 133.88, 0.03],
  ['Darwin', 'Australia', -12.46, 130.84, 0.15],
  // — East Asia —
  ['Vladivostok', 'Russia', 43.12, 131.89, 0.6],
  ['Sapporo', 'Japan', 43.06, 141.35, 2.0],
  ['Tokyo', 'Japan', 35.68, 139.69, 13.9],
  ['Osaka', 'Japan', 34.69, 135.5, 8.8],
  ['Hiroshima', 'Japan', 34.39, 132.46, 1.2],
  ['Fukuoka', 'Japan', 33.59, 130.4, 1.6],
  ['Busan', 'South Korea', 35.18, 129.08, 3.4],
  ['Seoul', 'South Korea', 37.57, 126.98, 9.7],
  ['Yakutsk', 'Russia', 62.03, 129.73, 0.3],
  // — Philippines, Taiwan, China, South-East Asia —
  ['Cebu', 'Philippines', 10.32, 123.89, 1.0],
  ['Manila', 'Philippines', 14.6, 120.98, 13.5],
  ['Taipei', 'Taiwan', 25.03, 121.57, 2.6],
  ['Hong Kong', 'China', 22.32, 114.17, 7.5],
  ['Shanghai', 'China', 31.23, 121.47, 24.9],
  ['Beijing', 'China', 39.9, 116.4, 21.5],
  ['Ulaanbaatar', 'Mongolia', 47.89, 106.91, 1.5],
  ['Irkutsk', 'Russia', 52.29, 104.3, 0.6],
  ['Xi’an', 'China', 34.34, 108.94, 12.9],
  ['Chengdu', 'China', 30.57, 104.07, 16.3],
  ['Hanoi', 'Vietnam', 21.03, 105.85, 8.1],
  ['Ho Chi Minh City', 'Vietnam', 10.82, 106.63, 9.0],
  ['Phnom Penh', 'Cambodia', 11.56, 104.92, 2.1],
  ['Denpasar', 'Indonesia', -8.65, 115.22, 0.9],
  ['Perth', 'Australia', -31.95, 115.86, 2.1],
  ['Jakarta', 'Indonesia', -6.21, 106.85, 10.6],
  ['Singapore', 'Singapore', 1.35, 103.82, 5.7],
  ['Kuala Lumpur', 'Malaysia', 3.14, 101.69, 1.8],
  ['Bangkok', 'Thailand', 13.76, 100.5, 10.5],
  ['Yangon', 'Myanmar', 16.87, 96.2, 5.2],
  // — South Asia & Central Asia —
  ['Novosibirsk', 'Russia', 55.01, 82.93, 1.6],
  ['Dhaka', 'Bangladesh', 23.81, 90.41, 21.0],
  ['Kolkata', 'India', 22.57, 88.36, 14.9],
  ['Kathmandu', 'Nepal', 27.72, 85.32, 1.4],
  ['Chennai', 'India', 13.08, 80.27, 11.0],
  ['Colombo', 'Sri Lanka', 6.93, 79.86, 0.6],
  ['Bengaluru', 'India', 12.97, 77.59, 12.3],
  ['Hyderabad', 'India', 17.39, 78.49, 10.0],
  ['Delhi', 'India', 28.61, 77.21, 31.0],
  ['Jaipur', 'India', 26.91, 75.79, 3.9],
  ['Mumbai', 'India', 19.08, 72.88, 20.4],
  ['Malé', 'Maldives', 4.17, 73.51, 0.25],
  ['Almaty', 'Kazakhstan', 43.24, 76.89, 2.0],
  ['Lahore', 'Pakistan', 31.55, 74.34, 13.1],
  ['Islamabad', 'Pakistan', 33.68, 73.05, 1.2],
  ['Karachi', 'Pakistan', 24.86, 67.01, 16.1],
  ['Tashkent', 'Uzbekistan', 41.3, 69.24, 2.6],
  ['Kabul', 'Afghanistan', 34.56, 69.21, 4.6],
  ['Yekaterinburg', 'Russia', 56.84, 60.65, 1.5],
  // — Middle East, Indian Ocean & East Africa —
  ['Muscat', 'Oman', 23.59, 58.41, 1.6],
  ['Dubai', 'United Arab Emirates', 25.2, 55.27, 3.4],
  ['Abu Dhabi', 'United Arab Emirates', 24.45, 54.38, 1.5],
  ['Port Louis', 'Mauritius', -20.16, 57.5, 0.15],
  ['Antananarivo', 'Madagascar', -18.88, 47.51, 1.3],
  ['Tehran', 'Iran', 35.69, 51.39, 9.0],
  ['Baku', 'Azerbaijan', 40.41, 49.87, 2.3],
  ['Doha', 'Qatar', 25.29, 51.53, 0.6],
  ['Riyadh', 'Saudi Arabia', 24.71, 46.68, 7.7],
  ['Kuwait City', 'Kuwait', 29.38, 47.99, 3.0],
  ['Baghdad', 'Iraq', 33.31, 44.36, 7.5],
  ['Yerevan', 'Armenia', 40.18, 44.51, 1.1],
  ['Tbilisi', 'Georgia', 41.72, 44.79, 1.2],
  ['Dar es Salaam', 'Tanzania', -6.79, 39.21, 6.7],
  ['Nairobi', 'Kenya', -1.29, 36.82, 4.4],
  ['Addis Ababa', 'Ethiopia', 9.03, 38.74, 5.0],
  ['Moscow', 'Russia', 55.76, 37.62, 12.5],
  ['St Petersburg', 'Russia', 59.93, 30.36, 5.4],
  ['Istanbul', 'Türkiye', 41.01, 28.98, 15.5],
  ['Jerusalem', 'Israel', 31.77, 35.21, 0.95],
  ['Amman', 'Jordan', 31.95, 35.93, 4.0],
  ['Beirut', 'Lebanon', 33.89, 35.5, 2.4],
  ['Cairo', 'Egypt', 30.04, 31.24, 20.9],
  // — Southern Africa —
  ['Maputo', 'Mozambique', -25.97, 32.58, 1.1],
  ['Durban', 'South Africa', -29.86, 31.02, 3.9],
  ['Johannesburg', 'South Africa', -26.2, 28.05, 5.6],
  ['Pretoria', 'South Africa', -25.75, 28.19, 2.6],
  ['Harare', 'Zimbabwe', -17.83, 31.05, 1.5],
  ['Lusaka', 'Zambia', -15.39, 28.32, 2.9],
  ['Kigali', 'Rwanda', -1.94, 30.06, 1.2],
  ['Cape Town', 'South Africa', -33.92, 18.42, 4.6],
  // — Eastern & Northern Europe —
  ['Athens', 'Greece', 37.98, 23.73, 3.2],
  ['Bucharest', 'Romania', 44.43, 26.1, 1.8],
  ['Kyiv', 'Ukraine', 50.45, 30.52, 3.0],
  ['Helsinki', 'Finland', 60.17, 24.94, 0.65],
  ['Tallinn', 'Estonia', 59.44, 24.75, 0.45],
  ['Riga', 'Latvia', 56.95, 24.11, 0.62],
  ['Vilnius', 'Lithuania', 54.69, 25.28, 0.59],
  ['Warsaw', 'Poland', 52.23, 21.01, 1.8],
  ['Budapest', 'Hungary', 47.5, 19.04, 1.8],
  ['Vienna', 'Austria', 48.21, 16.37, 1.9],
  ['Prague', 'Czechia', 50.08, 14.44, 1.3],
  ['Stockholm', 'Sweden', 59.33, 18.07, 0.98],
  ['Copenhagen', 'Denmark', 55.68, 12.57, 0.8],
  ['Oslo', 'Norway', 59.91, 10.75, 0.7],
  ['Berlin', 'Germany', 52.52, 13.4, 3.7],
  ['Munich', 'Germany', 48.14, 11.58, 1.5],
  ['Venice', 'Italy', 45.44, 12.34, 0.26],
  ['Rome', 'Italy', 41.9, 12.5, 2.8],
  ['Naples', 'Italy', 40.85, 14.27, 0.97],
  ['Milan', 'Italy', 45.46, 9.19, 1.4],
  ['Zurich', 'Switzerland', 47.37, 8.54, 0.42],
  ['Geneva', 'Switzerland', 46.2, 6.14, 0.2],
  ['Amsterdam', 'Netherlands', 52.37, 4.9, 0.87],
  ['Brussels', 'Belgium', 50.85, 4.35, 1.2],
  ['Paris', 'France', 48.86, 2.35, 2.2],
  ['Barcelona', 'Spain', 41.39, 2.17, 1.6],
  ['Madrid', 'Spain', 40.42, -3.7, 3.2],
  // — West & North Africa —
  ['Tripoli', 'Libya', 32.89, 13.19, 1.2],
  ['Tunis', 'Tunisia', 36.81, 10.18, 0.64],
  ['Algiers', 'Algeria', 36.74, 3.09, 2.4],
  ['Lagos', 'Nigeria', 6.52, 3.38, 15.4],
  ['Abuja', 'Nigeria', 9.06, 7.49, 3.6],
  ['Kinshasa', 'DR Congo', -4.44, 15.27, 15.6],
  ['Luanda', 'Angola', -8.84, 13.23, 8.3],
  ['Accra', 'Ghana', 5.6, -0.19, 2.5],
  ['Abidjan', 'Côte d’Ivoire', 5.36, -4.01, 5.6],
  // — Western Europe (GMT) & Atlantic —
  ['Lisbon', 'Portugal', 38.72, -9.14, 0.55],
  ['Casablanca', 'Morocco', 33.57, -7.59, 3.7],
  ['Dublin', 'Ireland', 53.35, -6.26, 1.2],
  ['Edinburgh', 'United Kingdom', 55.95, -3.19, 0.55],
  ['Manchester', 'United Kingdom', 53.48, -2.24, 2.8],
  ['London', 'United Kingdom', 51.51, -0.13, 9.0],
  ['Reykjavík', 'Iceland', 64.15, -21.94, 0.14],
  ['Ponta Delgada', 'Azores, Portugal', 37.74, -25.67, 0.07],
  ['Dakar', 'Senegal', 14.72, -17.47, 3.1],
  ['Praia', 'Cabo Verde', 14.93, -23.51, 0.17],
  // — South America —
  ['Recife', 'Brazil', -8.05, -34.88, 1.7],
  ['Salvador', 'Brazil', -12.97, -38.5, 2.9],
  ['Rio de Janeiro', 'Brazil', -22.91, -43.17, 6.7],
  ['São Paulo', 'Brazil', -23.55, -46.63, 12.3],
  ['Brasília', 'Brazil', -15.79, -47.88, 3.1],
  ['Montevideo', 'Uruguay', -34.9, -56.16, 1.4],
  ['Buenos Aires', 'Argentina', -34.6, -58.38, 15.2],
  ['Stanley', 'Falkland Islands', -51.69, -57.86, 0.01],
  ['Santiago', 'Chile', -33.45, -70.67, 6.8],
  ['Asunción', 'Paraguay', -25.26, -57.58, 0.53],
  ['La Paz', 'Bolivia', -16.49, -68.13, 0.94],
  ['Manaus', 'Brazil', -3.12, -60.02, 2.2],
  ['Nuuk', 'Greenland', 64.18, -51.69, 0.02],
  // — Caribbean & northern South America —
  ['Caracas', 'Venezuela', 10.49, -66.88, 2.9],
  ['San Juan', 'Puerto Rico', 18.47, -66.11, 0.34],
  ['Santo Domingo', 'Dominican Republic', 18.47, -69.9, 3.3],
  ['Kingston', 'Jamaica', 17.97, -76.79, 0.59],
  ['Bogotá', 'Colombia', 4.71, -74.07, 7.4],
  ['Quito', 'Ecuador', -0.18, -78.47, 1.8],
  ['Lima', 'Peru', -12.05, -77.04, 9.7],
  ['Panama City', 'Panama', 8.98, -79.52, 0.88],
  ['Havana', 'Cuba', 23.11, -82.37, 2.1],
  ['Nassau', 'Bahamas', 25.04, -77.35, 0.27],
  // — North America (east to west) —
  ['Halifax', 'Canada', 44.65, -63.58, 0.4],
  ['Miami', 'United States', 25.76, -80.19, 0.47],
  ['Atlanta', 'United States', 33.75, -84.39, 0.5],
  ['Washington, D.C.', 'United States', 38.91, -77.04, 0.69],
  ['Philadelphia', 'United States', 39.95, -75.17, 1.6],
  ['New York', 'United States', 40.71, -74.01, 8.5],
  ['Boston', 'United States', 42.36, -71.06, 0.69],
  ['Montreal', 'Canada', 45.5, -73.57, 1.8],
  ['Ottawa', 'Canada', 45.42, -75.7, 1.0],
  ['Toronto', 'Canada', 43.65, -79.38, 2.9],
  ['Detroit', 'United States', 42.33, -83.05, 0.64],
  ['Chicago', 'United States', 41.88, -87.63, 2.7],
  ['Minneapolis', 'United States', 44.98, -93.27, 0.43],
  ['Winnipeg', 'Canada', 49.9, -97.14, 0.75],
  ['New Orleans', 'United States', 29.95, -90.07, 0.38],
  ['Houston', 'United States', 29.76, -95.37, 2.3],
  ['Dallas', 'United States', 32.78, -96.8, 1.3],
  ['Mexico City', 'Mexico', 19.43, -99.13, 9.2],
  ['Guatemala City', 'Guatemala', 14.63, -90.51, 1.0],
  ['San José', 'Costa Rica', 9.93, -84.08, 0.35],
  ['Managua', 'Nicaragua', 12.11, -86.24, 1.1],
  ['Denver', 'United States', 39.74, -104.99, 0.72],
  ['Albuquerque', 'United States', 35.08, -106.65, 0.56],
  ['Phoenix', 'United States', 33.45, -112.07, 1.7],
  ['Salt Lake City', 'United States', 40.76, -111.89, 0.2],
  ['Calgary', 'Canada', 51.05, -114.07, 1.3],
  ['Edmonton', 'Canada', 53.55, -113.49, 1.0],
  ['Las Vegas', 'United States', 36.17, -115.14, 0.65],
  ['San Diego', 'United States', 32.72, -117.16, 1.4],
  ['Los Angeles', 'United States', 34.05, -118.24, 3.9],
  ['San Francisco', 'United States', 37.77, -122.42, 0.87],
  ['Portland', 'United States', 45.52, -122.68, 0.65],
  ['Seattle', 'United States', 47.61, -122.33, 0.74],
  ['Vancouver', 'Canada', 49.28, -123.12, 2.5],
  ['Juneau', 'United States', 58.3, -134.42, 0.03],
  ['Anchorage', 'United States', 61.22, -149.9, 0.29],
  ['Honolulu', 'United States', 21.31, -157.86, 0.35],
  ['Papeete', 'French Polynesia', -17.55, -149.57, 0.14],
  ['North Pole', 'Home again!', 84.6, 168.0, 0],
];

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance in km (haversine)
function distanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Stopover length scales with city size: 30s for hamlets up to 150s for megacities
function stopoverSeconds(weight) {
  if (weight <= 0) return 0;
  return Math.round(Math.min(150, 30 + weight * 6));
}

const legs = [];
let totalDistance = 0;
for (let i = 1; i < STOPS.length; i++) {
  const d = distanceKm([STOPS[i - 1][2], STOPS[i - 1][3]], [STOPS[i][2], STOPS[i][3]]);
  legs.push(d);
  totalDistance += d;
}

const totalStopover = STOPS.reduce((sum, s) => sum + stopoverSeconds(s[4]), 0);
const totalTravel = TOTAL_DURATION - totalStopover;
const totalWeight = STOPS.reduce((sum, s) => sum + s[4], 0);

const stops = [];
let t = 0;
let cumWeight = 0;
for (let i = 0; i < STOPS.length; i++) {
  const [city, region, lat, lng, weight] = STOPS[i];
  if (i > 0) t += (legs[i - 1] / totalDistance) * totalTravel;
  const arrival = Math.round(t);
  const dwell = stopoverSeconds(weight);
  t += dwell;
  cumWeight += weight;
  stops.push({
    city,
    region,
    lat,
    lng,
    t: arrival,
    d: dwell,
    p: Math.round((cumWeight / totalWeight) * TOTAL_PRESENTS),
  });
}
// Pin the final arrival exactly to the configured duration
stops[stops.length - 1].t = TOTAL_DURATION;
stops[stops.length - 1].p = TOTAL_PRESENTS;

const route = {
  v: 1,
  duration: TOTAL_DURATION,
  presentsTotal: TOTAL_PRESENTS,
  distanceKm: Math.round(totalDistance),
  stops,
};

const outPath = path.join(__dirname, '..', 'assets', 'santa-route.json');
fs.writeFileSync(outPath, JSON.stringify(route));
console.log(
  `Wrote ${stops.length} stops (${Math.round(totalDistance).toLocaleString()} km, ` +
    `${(fs.statSync(outPath).size / 1024).toFixed(1)} KB) to ${outPath}`
);
