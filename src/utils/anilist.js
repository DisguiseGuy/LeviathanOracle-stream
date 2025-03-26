import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';
const animeCache = new Map();

export async function fetchAnimeDetails(animeTitle) {
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        status
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
        coverImage {
          large
        }
      }
    }
  `;

  const variables = { search: animeTitle };

  try {
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    return response.data.data.Media;
  } catch (error) {
    console.error('Error fetching anime details:', error);
    throw error;
  }
}

export async function fetchAnimeDetailsById(animeId) {
  if (animeCache.has(animeId)) {
    return animeCache.get(animeId);
  }

  const response = await fetch(`https://graphql.anilist.co`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              romaji
              english
            }
            nextAiringEpisode {
              episode
              timeUntilAiring
            }
            coverImage {
              large
            }
          }
        }
      `,
      variables: { id: animeId },
    }),
  });

  const data = await response.json();
  if (data && data.data && data.data.Media) {
    animeCache.set(animeId, data.data.Media);
    return data.data.Media;
  }

  return null;
}