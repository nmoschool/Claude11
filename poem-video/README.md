# فيديو القصيدة — «دروس وتعابير»

- `poem_video.mp4`: فيديو عمودي 1080×1920 (62 ثانية) بموسيقى محيطية على مقام البياتي، من دون إلقاء.
- `make_video.py`: يولّد الفيديو: `python3 make_video.py`
- `narrate.py`: يضيف إلقاءً بصوت سعودي (`ar-SA-HamedNeural`):
  ```
  pip install edge-tts
  python3 narrate.py poem_video.mp4 poem_video_voice.mp4
  ```
  أو بتسجيلك الخاص: ضع `clips/00.mp3` … `clips/13.mp3` (شطر لكل ملف بالترتيب) ثم أضف `--own`.
