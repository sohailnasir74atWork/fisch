#!/usr/bin/env node
/**
 * Boot splash asset generator (light + dark).
 *
 * react-native-bootsplash ships a CLI that does this, but its `--dark-logo` /
 * `--dark-background` flags are behind a paid `--license-key`. The free CLI can
 * only emit a single logo, which is why this fork shipped the square app-icon
 * artwork on a #77B0DA background in both themes. This script reproduces what
 * the licensed generator would write, so the splash can use the white logo on
 * the dark background and the navy logo on the light one.
 *
 * It follows the library's own layout rules (node_modules/react-native-bootsplash
 * /dist/commonjs/generate.js): Android wants the logo composited onto a
 * transparent 288dp canvas — that is the icon window Android 12+ hands to
 * `windowSplashScreenAnimatedIcon` — and the artwork inside it must stay within
 * 192dp on both axes or the system crops it.
 *
 * Usage: node scripts/generate-bootsplash.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');

// Masters are the full-resolution transparent PNGs. `logo` is the navy artwork
// (drawn on the light background), `darkLogo` the white one (dark background).
const SOURCES = {
  logo: path.join(ROOT, 'assets/brand/bootsplash-logo.png'),
  darkLogo: path.join(ROOT, 'assets/brand/bootsplash-logo-dark.png'),
};

// Kept in sync with LIGHT.bg / DARK.bg in Code/Design/tokens.js so the splash
// hands over to the first React screen without a colour step.
const BACKGROUND = '#F4F9FB';
const DARK_BACKGROUND = '#0A1A22';

const ANDROID_CANVAS_DP = 288; // Android 12+ splash icon window
const ANDROID_LOGO_HEIGHT_DP = 180; // portrait logo, so height is the binding axis (max 192)
const IOS_LOGO_HEIGHT_PT = 200;

const ANDROID_DENSITIES = [
  { suffix: 'mdpi', ratio: 1 },
  { suffix: 'hdpi', ratio: 1.5 },
  { suffix: 'xhdpi', ratio: 2 },
  { suffix: 'xxhdpi', ratio: 3 },
  { suffix: 'xxxhdpi', ratio: 4 },
];

const ANDROID_RES = path.join(ROOT, 'android/app/src/main/res');
const IOS_ASSETS = path.join(ROOT, 'ios/FischValues/Images.xcassets');
const JS_ASSETS = path.join(ROOT, 'assets/bootsplash');

const ensureDir = dir => fs.mkdirSync(dir, { recursive: true });
const written = [];

const write = (file, buffer) => {
  fs.writeFileSync(file, buffer);
  written.push(`${path.relative(ROOT, file)} (${(buffer.length / 1024).toFixed(1)} KB)`);
};

/** Strip the transparent margin so sizing is driven by the artwork, not the export canvas. */
const trim = async file => {
  const buffer = await sharp(file).trim(1).png().toBuffer();
  const { width, height } = await sharp(buffer).metadata();
  return { buffer, width, height };
};

const resizeToHeight = (logo, height) =>
  sharp(logo.buffer)
    .resize({ height: Math.round(height), fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();

/**
 * The two masters differ by ~3px of trimmed margin, so sizing each by height
 * alone would leave the light and dark iOS variants a pixel apart and make
 * Xcode's image set inconsistent. Fitting both into one box keeps every scale
 * identical without stretching either logo.
 */
const resizeToBox = (logo, width, height) =>
  sharp(logo.buffer)
    .resize({
      width: Math.round(width),
      height: Math.round(height),
      fit: 'contain',
      kernel: 'lanczos3',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

/** Logo centred on the transparent 288dp canvas Android expects. */
const androidCanvas = async (logo, ratio) => {
  const size = ANDROID_CANVAS_DP * ratio;
  const input = await resizeToHeight(logo, ANDROID_LOGO_HEIGHT_DP * ratio);

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input }])
    .webp({ lossless: true })
    .toBuffer();
};

const generateAndroid = async (logo, darkLogo) => {
  for (const { suffix, ratio } of ANDROID_DENSITIES) {
    const light = path.join(ANDROID_RES, `drawable-${suffix}`);
    const dark = path.join(ANDROID_RES, `drawable-night-${suffix}`);

    ensureDir(light);
    ensureDir(dark);

    write(path.join(light, 'bootsplash_logo.webp'), await androidCanvas(logo, ratio));
    write(path.join(dark, 'bootsplash_logo.webp'), await androidCanvas(darkLogo, ratio));
  }
};

const hexToRgb = hex => {
  const int = parseInt(hex.replace('#', ''), 16);
  return { red: (int >> 16) & 255, green: (int >> 8) & 255, blue: int & 255 };
};

const hexToComponents = hex => {
  const { red, green, blue } = hexToRgb(hex);
  return {
    red: (red / 255).toFixed(3),
    green: (green / 255).toFixed(3),
    blue: (blue / 255).toFixed(3),
  };
};

/**
 * The launch screen is generated rather than hand-edited so its constraints can
 * never drift from the image set above. `image` and `name` both resolve through
 * the asset catalog at runtime, which is what gives iOS its dark variant.
 */
const launchScreenXml = ({ width, height }) => {
  const { red, green, blue } = hexToRgb(BACKGROUND);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/generate-bootsplash.js — edit that script, not this file. -->
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="15702" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina4_7" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="15704"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--View Controller-->
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" horizontalHuggingPriority="251" verticalHuggingPriority="251" image="BootSplashLogo" translatesAutoresizingMaskIntoConstraints="NO" id="Log-oV-iew">
                                <rect key="frame" x="${((375 - width) / 2).toFixed(1)}" y="${((667 - height) / 2).toFixed(1)}" width="${width}" height="${height}"/>
                                <constraints>
                                    <constraint firstAttribute="width" constant="${width}" id="Log-Wi-dth"/>
                                    <constraint firstAttribute="height" constant="${height}" id="Log-He-ght"/>
                                </constraints>
                            </imageView>
                        </subviews>
                        <color key="backgroundColor" name="BootSplashBackground"/>
                        <constraints>
                            <constraint firstItem="Log-oV-iew" firstAttribute="centerX" secondItem="Ze5-6b-2t3" secondAttribute="centerX" id="Log-Ce-ntX"/>
                            <constraint firstItem="Log-oV-iew" firstAttribute="centerY" secondItem="Ze5-6b-2t3" secondAttribute="centerY" id="Log-Ce-ntY"/>
                        </constraints>
                        <viewLayoutGuide key="safeArea" id="Bcu-3y-fUS"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="52.173913043478265" y="375"/>
        </scene>
    </scenes>
    <resources>
        <image name="BootSplashLogo" width="${width}" height="${height}"/>
        <namedColor name="BootSplashBackground">
            <color red="${(red / 255).toFixed(17)}" green="${(green / 255).toFixed(17)}" blue="${(blue / 255).toFixed(17)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
        </namedColor>
    </resources>
</document>
`;
};

const generateIOS = async (logo, darkLogo) => {
  if (!fs.existsSync(IOS_ASSETS)) {
    console.warn(`No ${path.relative(ROOT, IOS_ASSETS)} found. Skipping iOS assets…`);
    return;
  }

  const imageset = path.join(IOS_ASSETS, 'BootSplashLogo.imageset');
  ensureDir(imageset);

  const images = [];
  const widthPt = Math.round((IOS_LOGO_HEIGHT_PT * logo.width) / logo.height);

  for (const scale of [1, 2, 3]) {
    const width = widthPt * scale;
    const height = IOS_LOGO_HEIGHT_PT * scale;
    const lightName = `bootsplash-logo@${scale}x.png`;
    const darkName = `bootsplash-logo-dark@${scale}x.png`;

    write(path.join(imageset, lightName), await resizeToBox(logo, width, height));
    write(path.join(imageset, darkName), await resizeToBox(darkLogo, width, height));

    images.push({ idiom: 'universal', filename: lightName, scale: `${scale}x` });
    images.push({
      idiom: 'universal',
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      filename: darkName,
      scale: `${scale}x`,
    });
  }

  write(
    path.join(imageset, 'Contents.json'),
    Buffer.from(
      `${JSON.stringify({ images, info: { author: 'xcode', version: 1 } }, null, 2)}\n`,
    ),
  );

  const colorset = path.join(IOS_ASSETS, 'BootSplashBackground.colorset');
  ensureDir(colorset);

  const color = (hex, appearances) => ({
    idiom: 'universal',
    ...(appearances ? { appearances } : {}),
    color: {
      'color-space': 'srgb',
      components: { alpha: '1.000', ...hexToComponents(hex) },
    },
  });

  write(
    path.join(colorset, 'Contents.json'),
    Buffer.from(
      `${JSON.stringify(
        {
          colors: [
            color(BACKGROUND),
            color(DARK_BACKGROUND, [{ appearance: 'luminosity', value: 'dark' }]),
          ],
          info: { author: 'xcode', version: 1 },
        },
        null,
        2,
      )}\n`,
    ),
  );

  write(
    path.join(ROOT, 'ios/FischValues/LaunchScreen.storyboard'),
    Buffer.from(launchScreenXml({ width: widthPt, height: IOS_LOGO_HEIGHT_PT })),
  );
};

/** The library's own copy of the assets, kept so the manifest describes what shipped. */
const generateJSAssets = async (logo, darkLogo) => {
  ensureDir(JS_ASSETS);

  for (const { ratio } of ANDROID_DENSITIES) {
    const suffix = ratio === 1 ? '' : `@${String(ratio).replace('.', ',')}x`;

    write(
      path.join(JS_ASSETS, `logo${suffix}.png`),
      await resizeToHeight(logo, ANDROID_LOGO_HEIGHT_DP * ratio),
    );
    write(
      path.join(JS_ASSETS, `dark-logo${suffix}.png`),
      await resizeToHeight(darkLogo, ANDROID_LOGO_HEIGHT_DP * ratio),
    );
  }

  const { width, height } = await sharp(
    await resizeToHeight(logo, ANDROID_LOGO_HEIGHT_DP),
  ).metadata();

  write(
    path.join(JS_ASSETS, 'manifest.json'),
    Buffer.from(
      `${JSON.stringify(
        { background: BACKGROUND, darkBackground: DARK_BACKGROUND, logo: { width, height } },
        null,
        2,
      )}\n`,
    ),
  );
};

const main = async () => {
  for (const file of Object.values(SOURCES)) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing logo master: ${path.relative(ROOT, file)}`);
    }
  }

  const logo = await trim(SOURCES.logo);
  const darkLogo = await trim(SOURCES.darkLogo);

  for (const [name, { width, height }] of Object.entries({ logo, darkLogo })) {
    const scaled = (ANDROID_LOGO_HEIGHT_DP * width) / height;

    if (scaled > 192) {
      throw new Error(
        `${name} would be ${scaled.toFixed(0)}dp wide at ${ANDROID_LOGO_HEIGHT_DP}dp tall; Android crops past 192dp.`,
      );
    }
  }

  await generateAndroid(logo, darkLogo);
  await generateIOS(logo, darkLogo);
  await generateJSAssets(logo, darkLogo);

  console.log(written.join('\n'));
  console.log(`\n${written.length} files written.`);
};

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
