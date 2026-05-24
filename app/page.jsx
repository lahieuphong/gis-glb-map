import GisMap from '@/components/GisMap';
import { getPlacesGeojson } from '@/data/places';

export default function HomePage() {
  const placesGeojson = getPlacesGeojson();

  return <GisMap placesGeojson={placesGeojson} />;
}
