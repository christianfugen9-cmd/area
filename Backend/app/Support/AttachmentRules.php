<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Single source of truth for upload constraints, shared by every Form
 * Request that accepts files. Change the policy once, here.
 */
final class AttachmentRules
{
    /** Per-file ceiling in kilobytes (10 MB). */
    public const MAX_FILE_KILOBYTES = 10240;

    /** How many files one request may carry. */
    public const MAX_FILES_PER_REQUEST = 10;

    /**
     * Extension whitelist. `mimes` checks the guessed extension against the
     * real MIME type reported by the file itself, so a renamed .php cannot
     * sneak through as .jpg.
     *
     * @var list<string>
     */
    public const ALLOWED_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'csv', 'txt', 'zip',
    ];

    /**
     * Belt-and-braces MIME whitelist applied on top of the extension check.
     *
     * @var list<string>
     */
    public const ALLOWED_MIME_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/csv', 'text/plain',
        'application/zip', 'application/x-zip-compressed',
    ];

    /**
     * Rules applied to a single uploaded file.
     *
     * @return list<string>
     */
    public static function fileRules(): array
    {
        return [
            'file',
            'max:'.self::MAX_FILE_KILOBYTES,
            'mimes:'.implode(',', self::ALLOWED_EXTENSIONS),
            'mimetypes:'.implode(',', self::ALLOWED_MIME_TYPES),
        ];
    }
}