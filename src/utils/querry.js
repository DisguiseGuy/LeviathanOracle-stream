import axios from 'axios';

const anilistAPI = 'https://graphql.anilist.co';

export async function fetchAniListUser(username) {
  const query = `
    query ($username: String) {
      User(name: $username) {
        id
        name
        about
        avatar {
          large
        }
        statistics {
          anime {
            count
            meanScore
            minutesWatched
          }
          manga {
            count
            chaptersRead
            volumesRead
          }
        }
        favourites {
          anime {
            nodes {
              id
              title {
                romaji
                english
              }
              averageScore
              coverImage {
                large
              }
            }
          }
          manga {
            nodes {
              id
              title {
                romaji
                english
              }
              averageScore
              coverImage {
                large
              }
            }
          }
        }
      }        
    }
  `;

  const variables = { username };

  try {
    const response = await axios.post(anilistAPI, { query, variables });
    return response.data.data.User;
  } catch (error) {
    console.error('AniList API Error:', error);
    return null;
  }
}

export async function fetchMangaDetails(mangaTitle) {
  const query = `
    query ($search: String) {
      Media(search: $search, type: MANGA) {
        id
        title {
          romaji
          english
        }
        coverImage {
          large
        }
        chapters
      }
    }
  `;

  const variables = { search: mangaTitle };

  try {
    const response = await axios.post(anilistAPI, { query, variables });
    return response.data.data.Media;
  } catch (error) {
    console.error('AniList API Error:', error);
    return null;
  }
}