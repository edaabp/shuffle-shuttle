require("dotenv").config();

const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const axios = require("axios");

const app = express();

let accessToken = "";

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});


// LANDING PAGE
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
  <title>Shuffle Shuttle</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <style>

  body{
  background:#121212;
  color:white;
  font-family:Arial;
  display:flex;
  justify-content:center;
  align-items:center;
  height:100vh;
  margin:0;
  padding:20px;
  }

  .container{
  text-align:center;
  max-width:400px;
  width:100%;
  }

  button{
  width:100%;
  padding:16px;
  border:none;
  border-radius:30px;
  background:#1DB954;
  color:white;
  font-weight:bold;
  font-size:16px;
  cursor:pointer;
  }

  </style>

  </head>

  <body>

  <div class="container">

  <h1>🎧 Shuffle Shuttle</h1>

  <p>Shuffle your Spotify playlists</p>

  <a href="/login">
  <button>Connect Spotify</button>
  </a>

  </div>

  </body>
  </html>
  `);
});


// LOGIN
app.get("/login", (req, res) => {

  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-modify-playback-state",
    "playlist-modify-private",
    "playlist-modify-public"
  ];

  res.redirect(
    spotifyApi.createAuthorizeURL(scopes, "shuffle-shuttle", true)
  );
});


// CALLBACK → FETCH USER PLAYLISTS
app.get("/callback", async (req, res) => {
  try {

    const code = req.query.code;

    const data = await spotifyApi.authorizationCodeGrant(code);

    accessToken = data.body.access_token;
    spotifyApi.setAccessToken(accessToken);

    // Get user
    const user = await spotifyApi.getMe();
    const userId = user.body.id;

    let playlists = [];
    let offset = 0;

    while(true){

      const response = await spotifyApi.getUserPlaylists(userId,{
        limit:50,
        offset:offset
      });

      playlists = playlists.concat(response.body.items);

      if(response.body.items.length < 50) break;

      offset += 50;
    }

    const playlistHtml = playlists.map(p => `
      <form action="/shuffle" method="get">
        <input type="hidden" name="playlistId" value="${p.id}" />
        <button class="playlist">
          <img src="${p.images?.[0]?.url || ""}" />
          <div>
            <div class="name">${p.name}</div>
            <div class="count">${p.tracks.total} songs</div>
          </div>
        </button>
      </form>
    `).join("");

    res.send(`
      <!DOCTYPE html>
      <html>

      <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">

      <style>

      body{
      background:#121212;
      color:white;
      font-family:Arial;
      margin:0;
      padding:20px;
      }

      h2{
      text-align:center;
      }

      .playlist{
      width:100%;
      display:flex;
      align-items:center;
      background:#1e1e1e;
      border:none;
      color:white;
      padding:12px;
      border-radius:12px;
      margin-bottom:10px;
      cursor:pointer;
      }

      .playlist img{
      width:60px;
      height:60px;
      border-radius:6px;
      margin-right:15px;
      }

      .name{
      font-weight:bold;
      }

      .count{
      color:#aaa;
      font-size:14px;
      }

      </style>

      </head>

      <body>

      <h2>Select Playlist</h2>

      ${playlistHtml}

      </body>

      </html>
    `);

  } catch (err) {
    console.log("LOGIN ERROR:", err.response?.data || err.message);
    res.send("Login Error");
  }
});


// SHUFFLE (LOGIC UNCHANGED)
app.get("/shuffle", async (req, res) => {
  try {

    const playlistId = req.query.playlistId;

    if (!playlistId) {
      return res.send("Invalid playlist");
    }

    let tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50`;

    while (url) {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      tracks = tracks.concat(response.data.items);
      url = response.data.next;
    }

    let uris = tracks
      .filter(t => t?.item?.uri)
      .map(t => t.item.uri);

    uris = [...new Set(uris)];

    uris.sort(() => Math.random() - 0.5);

    await axios.put(
      `https://api.spotify.com/v1/playlists/${playlistId}/items`,
      {
        uris: uris.slice(0, 100)
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    for (let i = 100; i < uris.length; i += 100) {
      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/items`,
        {
          uris: uris.slice(i, i + 100)
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.send(`
      <html>
      <body style="background:#121212;color:white;font-family:Arial;text-align:center;padding-top:100px;">
      
      <h2>🎶 Playlist Shuffled</h2>

      <a href="https://open.spotify.com/playlist/${playlistId}" target="_blank">
      <button style="padding:14px 28px;border:none;border-radius:30px;background:#1DB954;color:white;">
      Open Playlist
      </button>
      </a>

      </body>
      </html>
    `);

  } catch (err) {
    console.log("FAILED:", err.response?.data || err.message);
    res.send("Error — check console");
  }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});