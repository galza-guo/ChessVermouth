# Multiplayer Chess

A local multiplayer chess game.
Created using node.js + Express + Socket.io, and React + tailwindcss. 

The [Chess.js](https://www.npmjs.com/package/chess.js?utm_source=infosec-jobs.com&utm_medium=infosec-jobs.com&utm_campaign=infosec-jobs.com&source=infosec-jobs.com) libary from npm was used for the chess engine.

![image](https://github.com/officialpranav/LAN-Chess/assets/57974336/3721ca03-ae05-4d66-a425-e1d198342390)

To run:
1. Ensure both computers are on the same network.
2. On one computer (the host), navigate to `/server` and run `npm run start`. Then in a separate terminal, navigate to `/client` and run `npm run dev`.
3. LAN multiplayer options:
   - Option A (host serves UI to others): on the other player’s device, open `http://<HOST_LAN_IP>:5173/?server=<HOST_LAN_IP>` in the browser.
   - Option B (each runs their own client): on the other player’s device, clone the repo, run the client (`npm run dev` in `/client`), and open `http://localhost:5173/?server=<HOST_LAN_IP>`.
4. Join the same room code in the lobby to play.

Notes:
- The dev server is now bound to the LAN automatically, so other devices can reach the client UI.
- The client will auto-detect the server IP from the page host. Supplying `?server=<HOST_LAN_IP>` is still supported and recommended when in doubt.

Todo:
- pawn promotion
- add toasts to alert user

### Credits to chess.com for chess piece icons.
