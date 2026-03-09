"use client";

import { Map, MapMarker, MarkerContent, MapControls } from "@/components/ui/map";
import { formatPrice } from "@/lib/utils";
import type { Property } from "@/types/property";

interface FullscreenMapProps {
  properties: Property[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  onPropertyClick: (id: string) => void;
}

export function FullscreenMap({ 
  properties, 
  hoveredId, 
  setHoveredId, 
  onPropertyClick 
}: FullscreenMapProps) {
  return (
    <Map 
      viewport={{ center: [3.4, 6.5], zoom: 10 }}
      className="w-full h-full"
    >
      <MapControls position="bottom-right" showCompass={false} />
      {properties.map((p) => (
         <MapMarker 
           key={p.id} 
           latitude={p.latitude!} 
           longitude={p.longitude!} 
           onClick={() => onPropertyClick(p.id)}
         >
             <MarkerContent>
                 <div 
                   className={`px-2 py-1 rounded-md shadow-md text-xs font-bold transition-transform hover:scale-110 whitespace-nowrap cursor-pointer ${hoveredId === p.id ? 'bg-primary text-white scale-110 z-50 relative' : 'bg-background text-foreground border'}`}
                   onMouseEnter={() => setHoveredId(p.id)}
                   onMouseLeave={() => setHoveredId(null)}
                 >
                   {formatPrice(p.price)}
                 </div>
             </MarkerContent>
         </MapMarker>
      ))}
    </Map>
  );
}
