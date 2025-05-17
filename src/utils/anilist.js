import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';
// Fetch anime details by ID
export async function fetchAnimeDetailsById(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
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

  const variables = { id };

  try {
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    return response.data.data.Media;
  } catch (error) {
    console.error('Error fetching anime details by ID:', error.response?.data || error.message);
    return null;
  }
}