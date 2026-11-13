# Monetization setup

Ads and affiliate links are off by default. No accounts were created and no paid services were enabled. Recommendation rankings do not use commissions or ad eligibility.

## bt's applications

| Program | Application | What to provide after approval |
|---|---|---|
| Fanatical | [Affiliate program](https://www.fanatical.com/en/affiliates), through Awin | Approved game-specific tracking links or product-feed access |
| Green Man Gaming | [Business Affiliate Program](https://www.greenmangaming.com/affiliates), through Impact | Approved game-specific tracking links or catalog/API access |
| Humble Bundle | [Partner entry point](https://www.humblebundle.com/partner); confirm the current Humble advertiser in [Impact](https://app.impact.com/) | Approved current tracking links; do not reuse legacy `partner=` links |
| Google AdSense | [Create/apply](https://adsense.google.com/start/) after indiefindr.gg is restored | Approved publisher ID (`ca-pub-…`) and a responsive ad-unit slot ID |

Fanatical's current official page calls the program free to join. GMG's official page directs website owners to its Business Affiliate Program. Humble's public partner endpoint could not be verified during this session; current availability and commercial terms must be confirmed in the advertiser account. No commission percentages are assumed in code.

## Affiliate config

Set these in the desired Vercel deployment only after the links are approved:

```dotenv
AFFILIATES_ENABLED=true
AFFILIATE_LINKS_JSON={"413150":[{"provider":"fanatical","url":"https://APPROVED-GAME-SPECIFIC-TRACKING-LINK"}]}
```

Providers are `humble`, `fanatical`, and `gmg`. Each game can have up to three approved HTTPS links. Links appear beneath the Steam button with a commission disclosure and `rel="sponsored noopener noreferrer"`. There are no guessed retailer product URLs, unavailable-game buttons, or invented affiliate IDs. Unmapped games continue to show the Steam link.

First-party affiliate clicks are recorded with `kind=click_affiliate`; position 1 identifies Humble, 2 Fanatical, and 3 GMG. Page/target appid identify the game. Actual attributed sales and commissions are reported by the affiliate network, not inferred from clicks.

Steam links include UTM source/medium/campaign parameters. [Steam UTM analytics](https://partner.steamgames.com/doc/marketing/utm_analytics) are publisher-side traffic attribution, not a commission program.

## Ad config

Supply the publisher ID first for site verification:

```dotenv
ADSENSE_CLIENT=ca-pub-YOUR_16_DIGIT_ID
```

That enables the account verification meta tag and `/ads.txt`, while ads remain off. After approval and account-side configuration, also supply:

```dotenv
ADS_ENABLED=true
ADSENSE_SLOT=YOUR_RESPONSIVE_UNIT_ID
```

One labeled responsive unit appears below the game's recommendations. With no ID/flag configured, the unit, placeholder, and Google advertising script are absent. `ads.txt` is generated from the configured account using Google's [documented format](https://support.google.com/adsense/answer/12171612).

AdSense runs its ads in third-party frames. Ad clicks are counted in AdSense's reports; this app does not intercept those frames, add click overlays, or fabricate first-party ad-click events. The schema reserves `click_ad` for future directly tracked ad links. Complete any consent/site requirements in the approved AdSense setup before enabling the script.

Changing monetization config requires a new deployment so prerendered and cached pages receive it. Production deployment still requires bt's OK.
