import axios from 'axios';

const ANILIST_API_URL = 'https://graphql.anilist.co';

export async function fetchAnimeDetails(input) {
  // Determine if the input is an ID (number) or a title (string)
  const isId = typeof input === 'number';

  const query = `
    query ($id: Int, $search: String) {
      Media(${isId ? 'id: $id' : 'search: $search'}, type: ANIME) {
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

  const variables = isId ? { id: input } : { search: input };

  try {
    const response = await axios.post(ANILIST_API_URL, { query, variables });
    return response.data.data.Media;
  } catch (error) {
    console.error('Error fetching anime details:', error);
    throw error;
  }
}