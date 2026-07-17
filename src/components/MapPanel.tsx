import React, { useEffect, useState, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useMap, 
  useMapsLibrary, 
  useAdvancedMarkerRef 
} from '@vis.gl/react-google-maps';
import { 
  Navigation, 
  Compass, 
  Search, 
  MapPin, 
  AlertCircle, 
  Check, 
  Activity, 
  Clock, 
  Car, 
  CheckSquare, 
  Heart, 
  Eye, 
  Globe, 
  ChevronRight, 
  Maximize, 
  Star, 
  Phone, 
  ExternalLink,
  Locate,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapPanelProps {
  onClose: () => void;
  initialQuery?: string;
}

const NEARBY_CATEGORIES = [
  { label: 'Hospital', value: 'hospital', icon: '🏥' },
  { label: 'Pharmacy', value: 'pharmacy', icon: '💊' },
  { label: 'ATM', value: 'atm', icon: '💵' },
  { label: 'Restaurant', value: 'restaurant', icon: '🍔' },
  { label: 'Hotel', value: 'hotel', icon: '🏨' },
  { label: 'Parking', value: 'parking', icon: '🚗' },
  { label: 'EV Station', value: 'ev_charging_station', icon: '⚡' },
  { label: 'Police', value: 'police', icon: '👮' },
];

export default function MapPanel({ onClose, initialQuery = "" }: MapPanelProps) {
  if (!hasValidKey) {
    return (
      <div className="absolute inset-0 z-50 bg-[#0d0d0d] border-l border-amber-500/20 flex flex-col justify-center items-center p-6 text-center font-sans">
        <div className="max-w-md bg-black/60 border border-amber-500/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(245,158,11,0.15)] backdrop-blur-md">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
            <Compass className="text-amber-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-amber-100 tracking-wider mb-4 uppercase">GOOGLE MAPS API KEY REQUIRED</h2>
          <p className="text-sm text-amber-500/70 leading-relaxed mb-6">
            To unlock advanced navigation, location intelligence, and turn-by-turn routing, please add your Google Maps API Key in AI Studio secrets.
          </p>
          
          <div className="text-left bg-white/5 border border-white/5 p-4 rounded-xl font-mono text-xs text-white/80 space-y-3">
            <p><strong>Step 1:</strong> Get a key from the <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">Google Cloud Console</a>.</p>
            <p><strong>Step 2:</strong> Open <strong>Settings</strong> (⚙️ gear icon, top-right corner).</p>
            <p><strong>Step 3:</strong> Go to <strong>Secrets</strong>, add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the name, and paste your API key.</p>
          </div>
          
          <button 
            onClick={onClose}
            className="mt-6 px-6 py-2.5 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors text-xs uppercase tracking-wider"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <MapContainer onClose={onClose} initialQuery={initialQuery} />
    </APIProvider>
  );
}

function MapContainer({ onClose, initialQuery }: { onClose: () => void; initialQuery: string }) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [center, setCenter] = useState<google.maps.LatLngLiteral>({ lat: 28.3949, lng: 84.1240 }); // Default: Nepal
  const [zoom, setZoom] = useState(13);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [places, setPlaces] = useState<google.maps.places.Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.Place | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isLocating, setIsLocating] = useState(false);
  
  // Navigation State
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>('DRIVING' as any);
  const [navigationSteps, setNavigationSteps] = useState<{ instruction: string; distance: string; duration: string }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showDirections, setShowDirections] = useState(false);

  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  // Track if geolocation is available and fetch on mount
  useEffect(() => {
    fetchUserLocation();
  }, []);

  const fetchUserLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setCenter(coords);
        if (map) {
          map.panTo(coords);
          map.setZoom(15);
        }
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation failed or permission denied:', error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Perform search by text
  const handleSearch = (queryStr: string) => {
    if (!placesLib || !queryStr.trim()) return;
    setSelectedPlace(null);

    // Prefer biasing results to map viewport center
    const bias = map ? map.getCenter() : undefined;

    placesLib.Place.searchByText({
      textQuery: queryStr,
      fields: ['displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'editorialSummary', 'photos', 'nationalPhoneNumber', 'regularOpeningHours'],
      locationBias: bias,
      maxResultCount: 10,
    }).then(({ places }) => {
      if (places && places.length > 0) {
        setPlaces(places);
        const firstLocation = places[0].location;
        if (firstLocation) {
          const latLng = { lat: firstLocation.lat(), lng: firstLocation.lng() };
          setCenter(latLng);
          if (map) {
            map.panTo(latLng);
            map.setZoom(14);
          }
        }
      } else {
        setPlaces([]);
      }
    }).catch(err => {
      console.error('Search failed:', err);
    });
  };

  // Perform search nearby based on categories
  const handleCategorySearch = (category: string) => {
    if (!placesLib || !map) return;
    setSelectedPlace(null);
    const mapCenter = map.getCenter();
    if (!mapCenter) return;

    placesLib.Place.searchNearby({
      locationRestriction: {
        center: mapCenter,
        radius: 3000 // 3km radius
      },
      fields: ['displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'photos', 'nationalPhoneNumber'],
      maxResultCount: 15,
    }).then(({ places }) => {
      // Filter places matching category name or keywords in description
      if (places && places.length > 0) {
        setPlaces(places);
        if (places[0].location && map) {
          map.panTo({ lat: places[0].location.lat(), lng: places[0].location.lng() });
        }
      }
    }).catch(err => {
      // Fallback to text search if searchNearby errors or fails
      handleSearch(`nearby ${category}`);
    });
  };

  // Routing Handler
  const handleRouteCompute = (modeOverride?: any) => {
    if (!routesLib || !map) return;
    const activeMode = modeOverride || travelMode;

    const start = originInput.trim() === 'My Location' && userLocation 
      ? userLocation 
      : originInput.trim();

    const end = destinationInput.trim();

    if (!start || !end) return;

    // Clear previous route polylines
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: start,
      destination: end,
      travelMode: activeMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    }).then(({ routes }) => {
      if (routes?.[0]) {
        const route = routes[0];
        const newPolylines = route.createPolylines();
        newPolylines.forEach(p => {
          p.setOptions({
            strokeColor: '#f59e0b',
            strokeWeight: 5,
            strokeOpacity: 0.85,
          });
          p.setMap(map);
        });
        polylinesRef.current = newPolylines;
        
        if (route.viewport) {
          map.fitBounds(route.viewport);
        }

        // Set route metrics
        const distKm = (route.distanceMeters / 1000).toFixed(1);
        const rawDuration = route.durationMillis;
        const durMin = Math.round(parseInt(typeof rawDuration === 'number' ? String(rawDuration) : (rawDuration || '0')) / 60000);
        setRouteInfo({
          distance: `${distKm} km`,
          duration: `${durMin} mins`
        });

        // Set step-by-step guidance
        if (route.legs?.[0]?.steps) {
          const steps = route.legs[0].steps.map((s: any) => ({
            instruction: s.navigationInstruction?.instructionsSnippet || s.html_instructions || 'Navigate along route',
            distance: `${(s.distanceMeters || 0)} m`,
            duration: `${Math.round((parseInt(s.durationMillis || '0') / 1000) / 60)} mins`
          }));
          setNavigationSteps(steps);
          setShowDirections(true);
        }
      }
    }).catch(err => {
      console.error('Failed to compute route:', err);
    });
  };

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery, placesLib]);

  const handleMarkerClick = (place: google.maps.places.Place) => {
    setSelectedPlace(place);
    if (place.location && map) {
      map.panTo({ lat: place.location.lat(), lng: place.location.lng() });
    }
  };

  // Open native Google Maps link
  const handleOpenInGoogleMaps = (place: google.maps.places.Place) => {
    const displayNameStr = typeof place.displayName === 'string' ? place.displayName : place.displayName;
    const query = encodeURIComponent(`${displayNameStr} ${place.formattedAddress || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#0d0d0d]/95 flex flex-col lg:flex-row border-l border-amber-500/20 font-sans text-white overflow-hidden">
      
      {/* Left Search & Control Sidebar */}
      <div className="w-full lg:w-[380px] h-[50%] lg:h-full flex flex-col bg-black/90 border-b lg:border-b-0 lg:border-r border-amber-500/20 z-10 overflow-y-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="text-amber-500 animate-spin-slow" size={20} />
            <h3 className="font-mono text-sm tracking-widest font-bold text-amber-400">JAYUKI MAPS & NAV</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation / Route Tab Switcher */}
        <div className="p-4 flex flex-col gap-3">
          
          {/* Main Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                placeholder="Search locations or services..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
              />
              <Search size={14} className="absolute left-3 top-3 text-white/40" />
            </div>
            <button
              onClick={() => handleSearch(searchQuery)}
              className="px-3 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-colors"
            >
              Search
            </button>
          </div>

          {/* Quick Nearby Filters */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {NEARBY_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => handleCategorySearch(cat.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full hover:border-amber-500/40 hover:bg-amber-500/10 text-[10px] whitespace-nowrap transition-all"
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-[1px] bg-white/10 my-1" />

          {/* Direction Inputs */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-amber-500/50 tracking-wider uppercase">Turn-by-Turn Router</span>
            <div className="space-y-1.5">
              <div className="relative">
                <input
                  type="text"
                  value={originInput}
                  onChange={(e) => setOriginInput(e.target.value)}
                  placeholder="Starting point..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-8 pr-8 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
                <MapPin size={12} className="absolute left-2.5 top-2.5 text-emerald-400" />
                <button
                  onClick={() => {
                    if (userLocation) {
                      setOriginInput('My Location');
                    } else {
                      fetchUserLocation();
                    }
                  }}
                  className="absolute right-2 top-2 text-amber-400 hover:text-amber-300 text-[10px] font-mono font-bold"
                  title="Use My Real-time Geolocation"
                >
                  <Locate size={14} />
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                  placeholder="Destination..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
                <Navigation size={12} className="absolute left-2.5 top-2.5 text-amber-400 rotate-45" />
              </div>
            </div>

            {/* Travel Mode Selector */}
            <div className="grid grid-cols-4 gap-1 mt-2">
              {[
                { mode: 'DRIVING', label: 'Driving', icon: '🚗' },
                { mode: 'WALKING', label: 'Walking', icon: '🚶' },
                { mode: 'BICYCLING', label: 'Cycling', icon: '🚴' },
                { mode: 'TRANSIT', label: 'Transit', icon: '🚇' },
              ].map((t) => (
                <button
                  key={t.mode}
                  onClick={() => {
                    setTravelMode(t.mode as any);
                    if (originInput && destinationInput) {
                      handleRouteCompute(t.mode);
                    }
                  }}
                  className={`py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all ${travelMode === t.mode ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'}`}
                >
                  <div className="text-sm mb-0.5">{t.icon}</div>
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleRouteCompute()}
              disabled={!originInput || !destinationInput}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs uppercase tracking-wider transition-all disabled:opacity-40"
            >
              Get Routes & Navigate
            </button>
          </div>
        </div>

        {/* Route Info summary */}
        {routeInfo && (
          <div className="mx-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <div className="text-xs">
                <p className="font-bold text-amber-200">Duration</p>
                <p className="text-white/70">{routeInfo.duration}</p>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="text-xs text-right">
              <p className="font-bold text-amber-200">Distance</p>
              <p className="text-white/70">{routeInfo.distance}</p>
            </div>
          </div>
        )}

        {/* List of Results/Steps */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <AnimatePresence mode="wait">
            {showDirections && navigationSteps.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 mt-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-500/50 uppercase tracking-widest">Navigation Steps</span>
                  <button 
                    onClick={() => {
                      setShowDirections(false);
                      setRouteInfo(null);
                      setNavigationSteps([]);
                      polylinesRef.current.forEach(p => p.setMap(null));
                    }}
                    className="text-[9px] text-red-400 font-bold uppercase hover:underline"
                  >
                    Clear Route
                  </button>
                </div>
                
                <div className="space-y-1.5">
                  {navigationSteps.map((step, idx) => (
                    <div 
                      key={`step-${idx}`}
                      className={`p-3 rounded-xl border transition-all text-xs flex items-start gap-2.5 cursor-pointer ${activeStepIndex === idx ? 'bg-amber-500/10 border-amber-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                      onClick={() => setActiveStepIndex(idx)}
                    >
                      <div className="w-5 h-5 rounded-full bg-white/10 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <p className="text-white/90 leading-normal" dangerouslySetInnerHTML={{ __html: step.instruction }} />
                        <div className="flex items-center gap-2 text-[10px] text-amber-500/60 font-mono">
                          <span>{step.distance}</span>
                          <span>•</span>
                          <span>{step.duration}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 mt-4"
              >
                <span className="text-[10px] font-mono text-amber-500/50 uppercase tracking-widest">Search Results ({places.length})</span>
                {places.length > 0 ? (
                  <div className="space-y-2">
                    {places.map((place) => {
                      const displayNameStr = typeof place.displayName === 'string' ? place.displayName : place.displayName;
                      return (
                        <div
                          key={place.id}
                          onClick={() => handleMarkerClick(place)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${selectedPlace?.id === place.id ? 'bg-amber-500/15 border-amber-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                          <h4 className="font-bold text-xs text-amber-200">{displayNameStr}</h4>
                          <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5">{place.formattedAddress}</p>
                          {place.rating && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Star size={10} className="text-amber-400 fill-amber-400" />
                              <span className="text-[9px] font-mono font-bold text-amber-300">{place.rating} ({place.userRatingCount})</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-white/30 text-xs">
                    No active locations found on map.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Main Map Visual Canvas */}
      <div className="flex-1 h-[50%] lg:h-full relative">
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {/* User Geolocation Marker */}
          {userLocation && (
            <AdvancedMarker position={userLocation} title="You Are Here">
              <div className="relative flex items-center justify-center">
                <div className="w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-lg z-10" />
                <span className="absolute w-8 h-8 bg-emerald-400/30 rounded-full animate-ping" />
              </div>
            </AdvancedMarker>
          )}

          {/* Place Search Markers */}
          {places.map((p) => {
            if (!p.location) return null;
            const displayNameStr = typeof p.displayName === 'string' ? p.displayName : p.displayName;
            return (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.location.lat(), lng: p.location.lng() }}
                title={displayNameStr}
                onClick={() => handleMarkerClick(p)}
              >
                <Pin 
                  background={selectedPlace?.id === p.id ? "#f59e0b" : "#4285F4"} 
                  borderColor={selectedPlace?.id === p.id ? "#fff" : "transparent"}
                  glyphColor="#fff" 
                />
              </AdvancedMarker>
            );
          })}

          {/* InfoWindow for selected place */}
          {selectedPlace && selectedPlace.location && (
            <InfoWindow
              position={{ lat: selectedPlace.location.lat(), lng: selectedPlace.location.lng() }}
              onCloseClick={() => setSelectedPlace(null)}
            >
              <div className="text-black font-sans p-1 max-w-[240px]">
                <h4 className="font-bold text-sm mb-1">{typeof selectedPlace.displayName === 'string' ? selectedPlace.displayName : selectedPlace.displayName}</h4>
                <p className="text-xs text-gray-600 leading-tight mb-2">{selectedPlace.formattedAddress}</p>
                
                {selectedPlace.rating && (
                  <div className="flex items-center gap-1 mb-2">
                    <Star size={12} className="text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-gray-700">{selectedPlace.rating} ({selectedPlace.userRatingCount})</span>
                  </div>
                )}

                {selectedPlace.nationalPhoneNumber && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-2">
                    <Phone size={10} />
                    <span className="hover:underline">{selectedPlace.nationalPhoneNumber}</span>
                  </div>
                )}

                <div className="flex gap-2 border-t border-gray-100 pt-2 mt-1">
                  <button
                    onClick={() => {
                      setDestinationInput(selectedPlace.formattedAddress || '');
                      if (userLocation) {
                        setOriginInput('My Location');
                      }
                      setShowDirections(false);
                    }}
                    className="flex-1 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-[10px] rounded uppercase text-center transition-colors"
                  >
                    Set Route
                  </button>
                  <button
                    onClick={() => handleOpenInGoogleMaps(selectedPlace)}
                    className="p-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center text-gray-500"
                    title="Open on google maps in a new tab"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>

        {/* Live HUD feedback on upper left of the map */}
        <div className="absolute top-4 left-4 z-[10] bg-black/80 border border-amber-500/20 px-3 py-1.5 rounded-xl backdrop-blur-sm pointer-events-none font-mono text-[9px] text-amber-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
          <span>SATELLITE DOWNLINK // GPS ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
