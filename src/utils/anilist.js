import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';

// Fetch anime details by ID or title
export async function fetchAnimeDetailsById(titleOrId) {
  try {
    const id = await ensureAnimeId(titleOrId);
    
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

    const response = await axios.post(ANILIST_API_URL, { query, variables });
    return response.data.data.Media;
  } catch (error) {
    console.error('Error fetching anime details:', error.response?.data || error.message);
    throw error;
  }
}

export async function ensureAnimeId(titleOrId) {
  // If it's already a number, return it
  if (!isNaN(titleOrId)) {
    return Number(titleOrId);
  }

  // Otherwise, search for the anime by title
  try {
    const searchResults = await fetchAnimeDetails(titleOrId);
    if (searchResults && searchResults.length > 0) {
      // Return the ID of the first match
      return searchResults[0].id;
    }
    throw new Error(`No anime found with title: ${titleOrId}`);
  } catch (error) {
    if (error.response?.data?.errors) {
      throw error;
    }
    throw new Error(`Failed to find anime: ${error.message}`);
  }
}

// Fetch anime details
export async function fetchAnimeDetails(search) {
  // ...existing code...
}