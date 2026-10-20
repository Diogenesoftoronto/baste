#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR=/home/diogenes/Projects/baste/media/fitting-loop
(cd "$PROJECT_DIR" &&
  rtk proxy mkdir -p renders
  for colors in 256 192 128 96; do
    rtk proxy env -u LD_LIBRARY_PATH /usr/bin/ffmpeg -v warning -y -i renders/fitting-loop.mp4 -filter_complex "fps=15,scale=960:504:flags=lanczos,format=rgb24,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 renders/fitting-loop.gif
    gif_bytes=$(rtk proxy stat -c %s renders/fitting-loop.gif)
    if ((gif_bytes <= 4000000)); then break; fi
  done
  if ((gif_bytes > 4000000)); then
    rtk proxy env -u LD_LIBRARY_PATH /usr/bin/ffmpeg -v warning -y -i renders/fitting-loop.mp4 -filter_complex "fps=12,scale=960:504:flags=lanczos,format=rgb24,setparams=color_primaries=bt709:color_trc=iec61966-2-1:colorspace=gbr,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 renders/fitting-loop.gif
    gif_bytes=$(rtk proxy stat -c %s renders/fitting-loop.gif)
  fi
  ((gif_bytes <= 4000000))
  rtk proxy env -u LD_LIBRARY_PATH magick renders/og-baste.png -quality 85 renders/fitting-loop-poster.jpg
  rtk proxy mkdir -p ../../site/public/media ../../docs
  rtk proxy cp renders/fitting-loop.mp4 renders/fitting-loop.gif renders/fitting-loop-poster.jpg ../../site/public/media/
  rtk proxy cp renders/og-baste.png ../../site/public/og-baste.png
  rtk proxy cp renders/fitting-loop.gif ../../docs/fitting-loop.gif
  rtk proxy stat -c "%n %s bytes" renders/fitting-loop.mp4 renders/fitting-loop.gif renders/fitting-loop-poster.jpg renders/og-baste.png ../../site/public/media/fitting-loop.mp4 ../../site/public/media/fitting-loop.gif ../../site/public/media/fitting-loop-poster.jpg ../../site/public/og-baste.png ../../docs/fitting-loop.gif
)
