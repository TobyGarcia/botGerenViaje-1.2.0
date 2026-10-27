"""Export the existing GV logo for Android notifications; no redesign."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
res = root / "frontend/android/app/src/main/res"
source = Image.open(root / "ISOLOGO.png").convert("RGBA")
source = source.crop(source.getchannel("A").getbbox())
for density, pixels in {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}.items():
    logo = source.copy()
    logo.thumbnail((pixels - 2, pixels - 2), Image.Resampling.LANCZOS)
    silhouette = Image.new("RGBA", logo.size, "white")
    silhouette.putalpha(logo.getchannel("A"))
    icon = Image.new("RGBA", (pixels, pixels))
    icon.alpha_composite(silhouette, ((pixels - logo.width) // 2, (pixels - logo.height) // 2))
    directory = res / f"drawable-{density}"
    directory.mkdir(exist_ok=True)
    icon.save(directory / "ic_stat_gv.png")

large = Image.new("RGBA", (192, 192))
ImageDraw.Draw(large).ellipse((0, 0, 191, 191), fill="#10232f")
source.thumbnail((152, 120), Image.Resampling.LANCZOS)
large.alpha_composite(source, ((192 - source.width) // 2, (192 - source.height) // 2))
directory = res / "drawable-nodpi"
directory.mkdir(exist_ok=True)
large.save(directory / "gv_notification_logo.png")
