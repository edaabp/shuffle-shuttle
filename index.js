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
  <html>
  <head>
  <title>Shuffle Shuttle</title>

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
  }

  .container{
  text-align:center;
  }

  button{
  padding:15px 30px;
  border-radius:30px;
  border:none;
  background:#1DB954;
  color:white;
  font-weight:bold;
  cursor:pointer;
  }

  button:hover{
  background:#1ed760;
  }

  </style>

  </head>

  <body>

  <div class="container">

  <h1>🎧 Shuffle Shuttle</h1>

  <p>Shuffle your Spotify playlist instantly</p>

  <a href="/login">
  <button>Connect Spotify Account</button>
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


// CALLBACK
app.get("/callback", async (req, res) => {
  try {

    const code = req.query.code;

    const data = await spotifyApi.authorizationCodeGrant(code);

    accessToken = data.body.access_token;
    spotifyApi.setAccessToken(accessToken);

    console.log("Scopes granted:", data.body.scope);

    res.send(`
      <html>
      <body style="background:#121212;color:white;font-family:Arial;text-align:center;padding-top:100px;">

      <h2>Shuffle Shuttle 🎧</h2>

      <form action="/shuffle" method="get">

      <input 
      name="playlist" 
      placeholder="Paste Spotify Playlist URL"
      style="width:420px;padding:10px;border-radius:8px;border:none"
      required
      />

      <br/><br/>

      <button style="padding:12px 25px;border:none;border-radius:25px;background:#1DB954;color:white;font-weight:bold">
      Shuffle Playlist
      </button>

      </form>

      </body>
      </html>
    `);

  } catch (err) {
    console.log(err);
    res.send("Login Error");
  }
});


// SHUFFLE EXISTING PLAYLIST
app.get("/shuffle", async (req, res) => {
  try {

    const playlistUrl = req.query.playlist;

    if (!playlistUrl) {
      return res.send("Please paste playlist URL");
    }

    const playlistId = playlistUrl.split("/playlist/")[1]?.split("?")[0];

    if (!playlistId) {
      return res.send("Invalid playlist URL");
    }

    console.log("Step 1: Get tracks");

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

    console.log("Tracks found:", tracks.length);

    let uris = tracks
      .filter(t => t?.item?.uri)
      .map(t => t.item.uri);

    uris = [...new Set(uris)];

    console.log("Valid tracks:", uris.length);

    uris.sort(() => Math.random() - 0.5);

    console.log("Replace playlist");

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
      <button style="padding:12px 25px;border:none;border-radius:25px;background:#1DB954;color:white;font-weight:bold">
      Open Playlist
      </button>
      </a>

      <br/><br/>

      <a href="/" style="color:#aaa">Shuffle Another</a>

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
