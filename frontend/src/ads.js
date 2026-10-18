export async function fetchRandomAdvertisement() {
  const response = await fetch('/api/ads/random');
  if (!response.ok) {
    throw new Error(`Advertisement request failed (${response.status})`);
  }
  return response.json();
}
