# generate_icons.py - Generate all required icon sizes for the extension
import os
from PIL import Image, ImageDraw

# Create icons directory if it doesn't exist
icon_dir = "extension/icons"
os.makedirs(icon_dir, exist_ok=True)

# Icon sizes required by Chrome extension
sizes = [16, 32, 48, 128]


def create_icon_with_pil(size):
    """Create icon using PIL"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale calculations
    center = size // 2
    radius = int(size * 0.47)
    inner_radius = int(size * 0.31)

    # Draw background circle (purple)
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], fill='#667eea')

    # Draw inner circle (white)
    draw.ellipse([center - inner_radius, center - inner_radius, center + inner_radius, center + inner_radius],
                 fill='#ffffff')

    # Draw memory network nodes
    node_radius = max(2, size // 16)
    line_width = max(1, size // 32)

    # Central node
    draw.ellipse([center - node_radius, center - node_radius, center + node_radius, center + node_radius],
                 fill='#667eea')

    # Draw connections
    positions = [
        (-size // 5, -size // 8),
        (size // 5, -size // 8),
        (-size // 5, size // 8),
        (size // 5, size // 8),
        (0, -size // 4),
        (0, size // 4)
    ]

    for px, py in positions:
        # Draw line from center to position
        draw.line([center, center, center + px, center + py], fill='#667eea', width=line_width)
        # Draw node
        node_x, node_y = center + px, center + py
        draw.ellipse([node_x - node_radius, node_y - node_radius, node_x + node_radius, node_y + node_radius],
                     fill='#764ba2')

    # Draw "C" for Claude
    if size >= 32:  # Only draw the C on larger icons
        c_size = size // 4
        c_thickness = max(2, size // 16)
        draw.arc([center - c_size, center - c_size // 2, center + c_size // 3, center + c_size // 2],
                 start=45, end=315, fill='#667eea', width=c_thickness)

    return img


# Generate icons
print("Generating icons...")

for size in sizes:
    img = create_icon_with_pil(size)
    output_path = os.path.join(icon_dir, f'icon{size}.png')
    img.save(output_path, 'PNG')
    print(f"Created {output_path}")

print("\nIcons generated successfully!")