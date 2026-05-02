#!/usr/bin/env python3
"""
Recolor banner images to asee blue (#4DACE2)
"""
from PIL import Image
import sys

def recolor_to_asee_blue(input_path, output_path):
    """Recolor an image to asee blue (#4DACE2) while maintaining luminance"""
    # Target color: asee blue
    target_r, target_g, target_b = 77, 172, 226  # #4DACE2
    
    # Open the image
    img = Image.open(input_path)
    
    # Convert to RGB if necessary
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Get image data
    pixels = img.load()
    width, height = img.size
    
    # Process each pixel
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            
            # Calculate grayscale value (luminance)
            luminance = 0.299 * r + 0.587 * g + 0.114 * b
            
            # Map luminance to the target color
            # Scale the target color by the luminance ratio
            factor = luminance / 255.0
            
            new_r = int(target_r * factor)
            new_g = int(target_g * factor)
            new_b = int(target_b * factor)
            
            pixels[x, y] = (new_r, new_g, new_b)
    
    # Save the result
    img.save(output_path, quality=95)
    print(f"✓ Recolored {input_path} → {output_path}")

if __name__ == "__main__":
    images = [
        ("src/images/banner-image-desktop.jpg", "src/images/banner-image-desktop.jpg"),
        ("src/images/banner-image-mobile.jpg", "src/images/banner-image-mobile.jpg"),
        ("src/images/pdf_banner.png", "src/images/pdf_banner.png"),
    ]
    
    for input_img, output_img in images:
        try:
            recolor_to_asee_blue(input_img, output_img)
        except Exception as e:
            print(f"✗ Error processing {input_img}: {e}", file=sys.stderr)
            sys.exit(1)
    
    print("\n✓ All images recolored successfully!")
