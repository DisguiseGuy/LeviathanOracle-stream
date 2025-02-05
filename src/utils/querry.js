const axios = require('axios');
const anilistAPI = 'https://graphql.anilist.co';

async function fetchAniListUser(username) {
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
                }
            }
        }
    `;

    const variables = { username };

    try {
        const response = await axios.post(anilistAPI, {
            query,
            variables,
        });
        return response.data.data.User;
    } catch (error) {
        console.error('AniList API Error:', error);
        throw new Error('Failed to fetch AniList user data.');
    }
}

module.exports = { fetchAniListUser };