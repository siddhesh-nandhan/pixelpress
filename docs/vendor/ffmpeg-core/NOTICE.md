# ffmpeg-core (ffmpeg.wasm)

`ffmpeg-core.js` and `ffmpeg-core.wasm` are the unmodified `@ffmpeg/core@0.12.10` single-threaded build of FFmpeg
(https://github.com/ffmpegwasm/ffmpeg.wasm), licensed under **GPL-2.0-or-later**. FFmpeg source:
https://ffmpeg.org/download.html and https://github.com/ffmpegwasm/ffmpeg.wasm-core.
It is loaded only when an audio file is compressed and runs entirely in the visitor's browser.
The JavaScript wrapper in `../ffmpeg/` is `@ffmpeg/ffmpeg@0.12.15` (MIT).
