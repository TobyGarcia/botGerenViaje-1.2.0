"""Export the existing GV logo for launcher and notification icons."""
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
color_logo = source.copy()
color_logo.thumbnail((152, 120), Image.Resampling.LANCZOS)
large.alpha_composite(color_logo, ((192 - color_logo.width) // 2, (192 - color_logo.height) // 2))
directory = res / "drawable-nodpi"
directory.mkdir(exist_ok=True)
large.save(directory / "gv_notification_logo.png")

for density, scale in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
    directory = res / f"mipmap-{density}"
    size = round(48 * scale)
    logo = source.copy()
    logo.thumbnail((round(36 * scale), round(30 * scale)), Image.Resampling.LANCZOS)
    for name, round_icon in {"ic_launcher": False, "ic_launcher_round": True}.items():
        icon = Image.new("RGBA", (size, size))
        draw = ImageDraw.Draw(icon)
        if round_icon:
            draw.ellipse((0, 0, size - 1, size - 1), fill="#10232f")
        else:
            draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=round(10 * scale), fill="#10232f")
        icon.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
        icon.save(directory / f"{name}.png")
    size = round(108 * scale)
    foreground = Image.new("RGBA", (size, size))
    logo = source.copy()
    logo.thumbnail((round(60 * scale), round(40 * scale)), Image.Resampling.LANCZOS)
    foreground.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    foreground.save(directory / "ic_launcher_foreground.png")
