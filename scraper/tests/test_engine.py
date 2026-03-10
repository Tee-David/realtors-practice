import asyncio
from scraper.engine.page_renderer import renderer
from scraper.engine.cookie_handler import CookieHandler

async def test_engine():
    print("Initializing Playwright...")
    await renderer.initialize()
    
    # Typical heavy JS real estate site or one with cookie banners
    test_urls = [
        "https://www.propertypro.ng/property-for-rent/in/lagos",
        "https://nigeriapropertycentre.com/for-rent/lagos"
    ]
    
    for url in test_urls:
        print(f"\n====================================")
        print(f"Testing URL: {url}")
        print(f"====================================")
        
        # Test 1: Render the page
        print("Rendering page...")
        result = await renderer.render_page(
            url=url, 
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        print(f"Success: {result['success']}")
        print(f"Status CODE: {result['status']}")
        print(f"Final URL: {result.get('url')}")
        html_len = len(result.get('html', ''))
        print(f"HTML Length: {html_len} bytes")
        
        if result['success'] and result.get('html'):
            # Just do a quick cookie handler dry-run if we wanted to (renderer handles isolation, so we can't easily pass the page object back out without modifying the renderer to return it, which is fine for production pipelines)
            print("Page successfully fetched and rendered by Playwright stealth browser.")
            
    await renderer.cleanup()
    print("\nTest complete.")

if __name__ == "__main__":
    asyncio.run(test_engine())
