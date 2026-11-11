<script lang="ts">
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import markerIcon from 'leaflet/dist/images/marker-icon.png';
  import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
  import markerShadow from 'leaflet/dist/images/marker-shadow.png';

  let { lat, lon }: { lat: number; lon: number } = $props();
  let el: HTMLDivElement;

  const icon = L.icon({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

  $effect(() => {
    const map = L.map(el, { attributionControl: false, zoomControl: true }).setView([lat, lon], 13);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(map);
    L.marker([lat, lon], { icon }).addTo(map);
    return () => map.remove();
  });
</script>

<div bind:this={el} class="map"></div>

<style>
  .map { height: 230px; border-radius: 10px; overflow: hidden; z-index: 0; }
</style>
