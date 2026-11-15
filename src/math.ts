// Renders the formulas in the server's Markdown ($...$ inline, $$...$$ display) to SVG images with MathJax: the
// Markdown of hovers and completion documentation cannot typeset math itself.
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html';
import { TeX } from 'mathjax-full/js/input/tex';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages';
import { mathjax } from 'mathjax-full/js/mathjax';
import { SVG } from 'mathjax-full/js/output/svg';

const EX_IN_PIXELS = 7; // size of one `ex` in the hover (the editor's font is about 14px)

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const html = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'none' }),
});

const cache = new Map<string, string>();

/** Returns the Markdown image of the formula, or the formula as code if it cannot be typeset. */
function renderFormula(tex: string, display: boolean, color: string): string {
    const key = `${display ? 'D' : 'I'}${color}${tex}`;
    let image = cache.get(key);
    if (image === undefined) {
        try {
            const container = html.convert(tex, { display });
            let svg = adaptor.innerHTML(container).replace(/^<mjx-container[^>]*>/, '').replace(/<\/mjx-container>$/, '');
            if (svg.includes('data-mml-node="merror"')) {
                throw new Error('invalid formula');
            }
            // The image is isolated from the page: give it the text color and a size in pixels.
            svg = svg
                .replace(/currentColor/g, color)
                .replace(/ width="([\d.]+)ex"/, (_, w) => ` width="${(parseFloat(w) * EX_IN_PIXELS).toFixed(2)}px"`)
                .replace(/ height="([\d.]+)ex"/, (_, h) => ` height="${(parseFloat(h) * EX_IN_PIXELS).toFixed(2)}px"`)
                .replace(/ style="[^"]*"/, '');
            const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
            image = `![formula](${uri})`;
        } catch {
            image = `\`${tex}\``;
        }
        cache.set(key, image);
    }
    return display ? `\n\n${image}\n\n` : image;
}

/**
 * Replaces the formulas in @p markdown by images. Code (spans and fences) is left alone.
 * @param dark whether the formulas are drawn for a dark theme (light text)
 */
export function renderMath(markdown: string, dark: boolean): string {
    if (!markdown.includes('$')) {
        return markdown;
    }
    const color = dark ? '#d4d4d4' : '#1e1e1e';
    return markdown
        .split(/(```[\s\S]*?```|`[^`\n]*`)/)
        .map((part, i) => {
            if (i % 2 === 1) {
                return part; // code
            }
            return part
                .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderFormula(tex.trim(), true, color))
                .replace(/\$([^$\n]+?)\$/g, (_, tex) => renderFormula(tex.trim(), false, color));
        })
        .join('');
}
