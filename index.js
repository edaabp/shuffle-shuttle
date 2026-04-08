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
  width:100%;
  max-width:420px;
  }

  h1{
  font-size:28px;
  }

  p{
  color:#aaa;
  }

  button{
  width:100%;
  padding:16px;
  border-radius:30px;
  border:none;
  background:#1DB954;
  color:white;
  font-weight:bold;
  cursor:pointer;
  font-size:16px;
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
      display:flex;
      justify-content:center;
      align-items:center;
      height:100vh;
      margin:0;
      padding:20px;
      }

      .container{
      width:100%;
      max-width:420px;
      text-align:center;
      }

      input{
      width:100%;
      padding:14px;
      border-radius:12px;
      border:none;
      font-size:16px;
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
      margin-top:15px;
      }

      </style>

      </head>

      <body>

      <div class="container">

      <h2>Shuffle Playlist 🎧</h2>

      <form action="/shuffle" method="get">

      <input 
      name="playlist" 
      placeholder="Paste Spotify Playlist URL"
      required
      />

      <button>Shuffle Playlist</button>

      </form>

      </div>

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
      <!DOCTYPE html>
      <html>

      <head>
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
      width:100%;
      max-width:420px;
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
      margin-top:10px;
      }

      a{
      text-decoration:none;
      }

      </style>

      </head>

      <body>

      <div class="container">

      <h2>🎶 Playlist Shuffled</h2>

      <a href="https://open.spotify.com/playlist/${playlistId}" target="_blank">
      <button>Open Playlist</button>
      </a>

      <a href="/">
      <button style="background:#333;margin-top:10px;">
      Shuffle Another
      </button>
      </a>

      </div>

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
