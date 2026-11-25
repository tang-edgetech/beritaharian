<?php

namespace App\Support;

/**
 * Article bodies are rich-text documents from the admin editor (Tiptap/ProseMirror JSON), never HTML.
 * clean() keeps only the parts the public site knows how to show, so nothing unexpected (scripts,
 * odd attributes, unsafe links) can be stored. toText() gives plain words for search and reading time.
 */
final class RichText
{
    private const NODES = ['doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'hardBreak', 'horizontalRule', 'image'];

    private const MARKS = ['bold', 'italic', 'strike', 'link'];

    public static function empty(): array
    {
        return ['type' => 'doc', 'content' => []];
    }

    public static function clean(?array $node, string $mediaBaseUrl): array
    {
        if (! $node || ($node['type'] ?? null) !== 'doc') {
            return self::empty();
        }

        return self::cleanNode($node, $mediaBaseUrl) ?? self::empty();
    }

    private static function cleanNode(array $node, string $mediaBaseUrl): ?array
    {
        $type = $node['type'] ?? null;
        if (! in_array($type, self::NODES, true)) {
            return null;
        }

        $clean = ['type' => $type];

        if ($type === 'text') {
            $text = (string) ($node['text'] ?? '');
            if ($text === '') {
                return null;
            }
            $clean['text'] = mb_substr($text, 0, 20000);
            $marks = collect($node['marks'] ?? [])->map(fn ($mark) => self::cleanMark($mark))->filter()->values()->all();
            if ($marks) {
                $clean['marks'] = $marks;
            }

            return $clean;
        }

        if ($type === 'heading') {
            $clean['attrs'] = ['level' => in_array($node['attrs']['level'] ?? 2, [2, 3], true) ? $node['attrs']['level'] : 2];
        }

        if ($type === 'orderedList') {
            $clean['attrs'] = ['start' => max(1, (int) ($node['attrs']['start'] ?? 1))];
        }

        if ($type === 'image') {
            $src = (string) ($node['attrs']['src'] ?? '');
            // only pictures uploaded to our own media library
            if (! str_starts_with($src, $mediaBaseUrl)) {
                return null;
            }
            $clean['attrs'] = [
                'src' => $src,
                'alt' => mb_substr((string) ($node['attrs']['alt'] ?? ''), 0, 200),
                'title' => mb_substr((string) ($node['attrs']['title'] ?? ''), 0, 200) ?: null,
            ];

            return $clean;
        }

        if (isset($node['content']) && is_array($node['content'])) {
            $children = collect($node['content'])->map(fn ($child) => is_array($child) ? self::cleanNode($child, $mediaBaseUrl) : null)->filter()->values()->all();
            if ($children) {
                $clean['content'] = $children;
            }
        }

        return $clean;
    }

    private static function cleanMark(mixed $mark): ?array
    {
        $type = is_array($mark) ? ($mark['type'] ?? null) : null;
        if (! in_array($type, self::MARKS, true)) {
            return null;
        }
        if ($type !== 'link') {
            return ['type' => $type];
        }
        $href = trim((string) ($mark['attrs']['href'] ?? ''));
        if (! preg_match('#^(https?://|mailto:)#i', $href)) {
            return null;
        }

        return ['type' => 'link', 'attrs' => ['href' => mb_substr($href, 0, 500)]];
    }

    public static function toText(?array $node): string
    {
        if (! $node) {
            return '';
        }
        if (($node['type'] ?? null) === 'text') {
            return (string) ($node['text'] ?? '');
        }
        $parts = array_map(fn ($child) => is_array($child) ? self::toText($child) : '', $node['content'] ?? []);
        $joiner = in_array($node['type'] ?? null, ['doc', 'bulletList', 'orderedList', 'blockquote', 'listItem'], true) ? "\n" : '';

        return trim(implode($joiner, $parts));
    }

    public static function wordCount(string $text): int
    {
        return count(preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY));
    }
}
