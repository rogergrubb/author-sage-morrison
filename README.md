# Sage Morrison - Author Website

A beautiful, literary-inspired landing page for author Sage Morrison, featuring an elegant design with organic textures, sophisticated typography, and smooth animations.

## Design Features

- **Literary Aesthetic**: Distinctive design inspired by classic book layouts with modern web techniques
- **Elegant Typography**: Uses Playfair Display and Crimson Text for a refined, readable experience
- **Organic Animations**: Subtle floating ink stain effects and smooth scroll-triggered reveals
- **Responsive Design**: Fully responsive across all devices
- **Sophisticated Color Palette**: Cream, sage green, charcoal, and gold accents create a warm, inviting atmosphere

## Sections

1. **Hero** - Striking introduction with author photo placeholder and compelling tagline
2. **Featured Works** - Showcase of books with elegant book cover placeholders
3. **About** - Author biography with credentials highlighting 21+ years in recovery
4. **Contact** - Multiple contact methods for speaking engagements and inquiries

## Technology Stack

- Pure HTML5, CSS3, and JavaScript
- Google Fonts (Playfair Display, Crimson Text)
- CSS Grid and Flexbox for layout
- Intersection Observer API for scroll animations
- No external dependencies or frameworks

## Setup Instructions

### Local Development

1. Simply open `index.html` in a web browser
2. No build process or dependencies required

### Deployment to Vercel

1. Push this repository to GitHub
2. Connect the repository to Vercel
3. Vercel will automatically detect and deploy the static site
4. No configuration needed - it's ready to go!

### Adding Author Photo

Replace the photo placeholder in the hero section:
- Replace the `.photo-content` div content in `index.html`
- Recommended image: 600x800px portrait
- Use an `<img>` tag with class `author-photo`
- Image will automatically be styled to fit the frame

Example:
```html
<div class="photo-content">
    <img src="images/sage-morrison.jpg" alt="Sage Morrison" class="author-photo">
</div>
```

Add this CSS to `styles.css`:
```css
.author-photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}
```

### Adding Book Covers

Replace book cover placeholders in the Books section:
- Replace `.book-placeholder` content with actual book cover images
- Recommended size: 600x800px
- Use descriptive alt text for accessibility

## Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --cream: #FAF8F3;
    --ink: #1A1614;
    --sage: #8B9D83;
    --gold: #C9A961;
}
```

### Content
Edit text directly in `index.html`:
- Update book titles and descriptions
- Modify about section text
- Change contact information

### Fonts
To change fonts, update Google Fonts link in `index.html` and CSS variables in `styles.css`

## Performance

- Optimized loading with font preconnect
- Minimal JavaScript for enhanced performance
- No heavy external libraries
- CSS animations use GPU acceleration
- Lazy loading ready for images

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

Consider adding:
- Blog section for author updates
- Newsletter signup integration
- Social media feed integration
- Book purchase links to retailers
- Reading group discussion guides
- Event calendar for speaking engagements

## License

All rights reserved © 2025 Sage Morrison

## Contact

For website updates or technical support, contact the development team.
