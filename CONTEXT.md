# Articol Domain Context

Articol is a visual album-discovery product. It treats album artwork as a
first-class object for study, comparison, saving, and sharing.

## Domain glossary

### Share Studio

The Share Studio is the album-page experience for preparing and publishing an
album artwork card. It presents the canonical portrait post image, provides
native image sharing and download fallbacks, and keeps album-link copying as a
separate action.

### Portrait post image

The 1080 x 1350 (4:5) artwork card intended for image-first platforms such as
Instagram. It is shared as an image file when the browser and device support
file sharing; otherwise it is downloaded for posting from Photos or Gallery.

### Social-link preview

The 1200 x 630 artwork card used by Open Graph and Twitter-compatible link
unfurls. It accompanies the album page URL on Facebook, X, LinkedIn, messaging
applications, and other link-based sharing surfaces.

### Dialog Frame

The shared overlay lifecycle used by the Share Studio and match explanation.
It owns page scroll locking, focus capture and return, Escape and outside-click
handling, close animation completion, and the single internal scroll viewport.

