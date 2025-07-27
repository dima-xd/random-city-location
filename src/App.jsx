import React, {useEffect, useRef, useState} from 'react';

export default function RandomLocation() {
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(0)
  const [coords, setCoords] = useState(null);
  const [result, setResult] = useState('Result will appear here...');
  const [loading, setLoading] = useState(false);

  const cacheRef = useRef({});

  function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    let R = 6371;
    let dLat = deg2rad(lat2 - lat1);
    let dLon = deg2rad(lon2 - lon1);
    let a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  useEffect(() => {
    if (Number(radius) > 0) {
      const options = {
        enableHighAccuracy: true,
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {},
        options
      );
    } else {
      setCoords(null);
    }
  }, [radius]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setResult('Please enter a city name.');
      return;
    }

    const key = trimmedCity.toLowerCase();

    setLoading(true);
    setResult('Loading data... Please wait.');

    try {
      let elements = cacheRef.current[key];

      if (!elements) {
        const query = `
[out:json][timeout:180];
area["name"="${trimmedCity}"]->.a;
(
  node(area.a)[name];
  relation(area.a)[name];
);
out center;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        elements = data.elements || [];

        cacheRef.current[key] = elements;
      }

      if (elements.length === 0) {
        setResult(`No locations found in city "${trimmedCity}".`);
        return;
      }

      let location
      let lat = null;
      let lon = null;

      let locationsInRadius = [];
      if (coords) {
        for (let i = 0; i < elements.length; i++) {
          if (elements[i].type === 'node') {
            lat = elements[i].lat;
            lon = elements[i].lon;
          } else if (elements[i].center) {
            lat = elements[i].center.lat;
            lon = elements[i].center.lon;
          }
          if (radius - getDistanceFromLatLonInKm(coords.lat, coords.lon, lat, lon) > 0) {
            locationsInRadius.push(elements[i])
          }
        }
        location = locationsInRadius[Math.floor(Math.random() * locationsInRadius.length)];
      } else {
        location = elements[Math.floor(Math.random() * elements.length)];
      }

      if (!location) {
        setResult(`No locations found in city "${trimmedCity}".`);
        return;
      }

      const tags = location.tags || {};
      const name = tags.name || 'Unnamed';
      if (location.type === 'node') {
        lat = location.lat;
        lon = location.lon;
      } else if (location.center) {
        lat = location.center.lat;
        lon = location.center.lon;
      }

      console.log(location)

      const coordsStr =
        lat !== null && lon !== null
          ? `${lat.toFixed(6)}, ${lon.toFixed(6)}`
          : 'Not available';

      const tagPriority = [
        'type',
        'shop',
        'amenity',
        'highway',
        'craft',
        'office',
        'public_transport',
        'leisure',
        'attraction',
        'tourism',
        'historic',
        'place',
        'club',
        'disused:amenity',
        'building'
      ];

      let type = '';
      for (const key of tagPriority) {
        if (location.tags[key]) {
          type = location.tags[key];
          break;
        }
      }

      let result = `Name: ${name}<br/>Coordinates: ${coordsStr}`;

      if (type !== "") {
        result += `<br/>Type: ${type.replaceAll("_", " ")}`;
      }

      if (coords) {
        const dist = getDistanceFromLatLonInKm(coords.lat, coords.lon, lat, lon).toFixed(2);
        result += `<br/>Distance to: ${dist} km`;
      }

      const mapUrl = `https://yandex.ru/maps/?pt=${lon},${lat}&z=12&l=map`;
      result += `<br/><a href="${mapUrl}" target="_blank">Open in Yandex Maps</a>`;

      setResult(result);
    } catch (error) {
      setResult('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100">
      <div className="w-100" style={{ maxWidth: '500px' }}>
        <div className="p-4 border rounded">
          <h4 className="text-center">Select a city and get a random location</h4>
          <form onSubmit={handleSubmit}>
            <div className="input-group mb-3 p-2">
              <input
                id="cityInput"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                type="text"
                className="form-control"
                placeholder="City"
                required
              />
              <input type="number" onChange={(e) => setRadius(e.target.value)} id="radiusInput" value={radius} className="form-control" placeholder="Radius (in km)" />
            </div>
            <button type="submit" className="btn btn-primary w-100 mb-3">
              {loading ? 'Loading...' : 'Randomize'}
            </button>
          </form>
          <hr />
          <div id="result" dangerouslySetInnerHTML={{ __html: result }} />
        </div>
      </div>
    </div>
  );
}
