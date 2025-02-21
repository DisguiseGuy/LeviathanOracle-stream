# LeviathanOrcale 

A Discord bot built to manage anime watchlists, link user profiles from MyAnimeList and AniList, search for anime/manga details, and fetch English-translated anime from Nyaa.
The idea for this bot was given by my friend [baku](https://github.com/maiorikizu) and brought to life by me [Pilot_kun](https://github.com/PilotKun). 

## Features

- **Profile Linking & Retrieval**  
  - Link your MyAnimeList or AniList account using the `/linkprofile` command (src/commands/linkprofile.js).  
  - View your linked profiles with `/linkedprofile` (src/commands/linked-profile.js).  
  - Fetch AniList profiles using `/search-profile-anilist` (src/commands/search-profile-anilist.js) and MyAnimeList profiles using `/search-profile-mal` (src/commands/search-profile-mal.js).

- **Anime/Manga Search**  
  - Search for anime details with `/search-anime` (src/commands/search-anime.js).  
  - Search for manga details with `/search-manga` (src/commands/search-manga.js).

- **Watchlist Management**  
  - Add anime to your watchlist using `/watchlist add` (src/commands/watchlist.js).  
  - Remove anime from your watchlist using `/watchlist remove` (src/commands/watchlist.js).  
  - Display your current watchlist with `/watchlist show` (src/commands/watchlist.js).  
  - Automatic checking for upcoming episodes based on users' watchlists and notifying them in DM's (haven't started this yet).

- **Nyaa Anime Fetching**  
  - Search for English-translated anime torrents from Nyaa using `/nyaa` (src/commands/nyaa.js).  
  - Utility functions for RSS feed parsing and filtering are implemented in [`src/utils/nyaaRSS.js`](src/utils/nyaaRSS.js). 

## Resources & Dependencies

- **Discord.js**: For interacting with Discord APIs and handling interactions.  
- **Axios**: HTTP client for fetching data from AniList, MyAnimeList (via Jikan API), and Nyaa RSS feeds.  
- **SQLite3**: Database used for storing user profile links and watchlists (src/database/db.js).  
- **rss-parser**: For parsing the Nyaa RSS feed (src/utils/nyaaRSS.js). 

## References & Acknowledgements

- [Discord.js Documentation](https://discord.js.org/#/docs)  
- [AniList GraphQL API](https://anilist.gitbook.io/anilist-apiv2-docs/)  
- [Jikan API for MyAnimeList](https://jikan.moe/)  
- [Nyaa Torrent RSS](https://nyaa.si)