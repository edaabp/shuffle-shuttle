require("dotenv").config();

const express = require("express");
const SpotifyWebApi = require("spotify-web-api-node");
const axios = require("axios");

const app = express();

function createSpotify() {
  return new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
  });
}


// Landing Page
app.get("/", (req, res) => {
  res.send(`
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
  }

  .container{
  text-align:center;
  max-width:400px;
  width:100%;
  }

  button{
  padding:16px 28px;
  border:none;
  border-radius:30px;
  background:#1DB954;
  color:white;
  font-size:16px;
  width:100%;
  }

  </style>

  </head>

  <body>

  <div class="container">

  <h1>Shuffle Shuttle</h1>

  <a href="/login">
  <button>Connect Spotify</button>
  </a>

  </div>

  </body>
  </html>
  `);
});


// Login
app.get("/login", (req, res) => {

  const spotifyApi = createSpotify();

  const scopes = [
    "user-read-private",
    "user-read-email",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-private",
    "playlist-modify-public"
  ];

  const authorizeURL = spotifyApi.createAuthorizeURL(
    scopes,
    "shuffle-shuttle"
  );

  res.redirect(authorizeURL);
});


// Callback (Playlists)
app.get("/callback", async (req, res) => {

  try {

    const spotifyApi = createSpotify();

    let accessToken;
    let code = req.query.code;

    if(code){
      const data = await spotifyApi.authorizationCodeGrant(code);
      accessToken = data.body.access_token;
    } else {
      accessToken = req.query.token;
    }

    spotifyApi.setAccessToken(accessToken);

    // get user
    const me = await spotifyApi.getMe();
    const userId = me.body.id;

    let playlists = [];
    let offset = 0;

    while(true){

      const response = await spotifyApi.getUserPlaylists({
        limit:50,
        offset:offset
      });

      playlists = playlists.concat(response.body.items);

      if(response.body.items.length < 50) break;

      offset += 50;
    }

    // filter playlists
    playlists = playlists.filter(p =>
      p.owner?.id === userId || p.collaborative
    );

    const playlistHtml = playlists.map(p => `
      <form action="/shuffle" method="get">
        <input type="hidden" name="playlistId" value="${p.id}" />
        <input type="hidden" name="token" value="${accessToken}" />
        <button class="playlist">
          <img src="${p.images?.[0]?.url || ""}" />
          <div>
            <div class="name">${p.name || "Untitled Playlist"}</div>
            <div class="count">${p.tracks?.total || 0} songs</div>
          </div>
        </button>
      </form>
    `).join("");

    res.send(`

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
    margin:0;
    }

    .container{
    width:100%;
    max-width:500px;
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
    text-align:left;
    }

    img{
    width:60px;
    height:60px;
    border-radius:6px;
    margin-right:12px;
    }

    .name{
    font-weight:bold;
    }

    .count{
    font-size:14px;
    color:#aaa;
    }

    </style>

    </head>

    <body>

    <div class="container">

    <h2>Select Playlist</h2>

    ${playlistHtml}

    </div>

    </body>

    </html>

    `);

  } catch (err) {

    console.log("LOGIN ERROR:", err.response?.data || err.message);

    res.send("Login Error");

  }

});


// Shuffle
app.get("/shuffle", async (req, res) => {

  try {

    const playlistId = req.query.playlistId;
    const accessToken = req.query.token;

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
      { uris: uris.slice(0,100) },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    for (let i = 100; i < uris.length; i += 100) {

      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/items`,
        { uris: uris.slice(i, i + 100) },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

    }

    res.send(`

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
    }

    .container{
    text-align:center;
    max-width:400px;
    width:100%;
    }

    button{
    width:100%;
    padding:14px;
    border-radius:30px;
    border:none;
    background:#1DB954;
    color:white;
    margin-top:10px;
    }

    </style>

    </head>

    <body>

    <div class="container">

    <h2>Playlist Shuffled 🎵</h2>

    <a href="https://open.spotify.com/playlist/${playlistId}">
    <button>Open Playlist</button>
    </a>

    <a href="/callback?token=${accessToken}">
    <button style="background:#333;">Back to Playlists</button>
    </a>

    </div>

    </body>

    </html>

    `);

  } catch (err) {

    console.log("SHUFFLE ERROR:", err.response?.data || err.message);

    res.send("Error Shuffling");

  }

});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Running on port", PORT);
});