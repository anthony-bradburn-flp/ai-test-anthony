from PIL import Image
from collections import Counter

img = Image.open('attached_assets/image_1772641297788.png')
img = img.convert('RGB')
pixels = img.getdata()
counts = Counter(pixels)
for color, count in counts.most_common(10):
    if count > 100:
        print(f"#{color[0]:02x}{color[1]:02x}{color[2]:02x} - {count}")
