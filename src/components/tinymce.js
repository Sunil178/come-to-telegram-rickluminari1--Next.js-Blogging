'use client'
import { Editor } from "@tinymce/tinymce-react";
import { useRef } from "react";
import { TinyOptions } from '@/components/tinymce-constants';

export function TinyMCEEditor(props) {
  const editorRef = useRef(null);
  return <>
      <Editor
        id="my-editor"
        textareaName="post_data"
        tinymceScriptSrc={"/assets/libs/tinymce/tinymce.min.js"}
        onInit={(evt, editor) => {
          editorRef.current = editor;
          setTimeout(() => {
            document.querySelector('.tox-toolbar-overlord').firstChild.lastChild.firstChild.classList.add('submit-btn');
            document.querySelector('.tox-toolbar-overlord').firstChild.lastChild.classList.add('submit-btn-container');
          }, 1000);
        }}
        init={{
          license_key: 'gpl',
          base_url: '/assets/libs/tinymce',
          suffix: '.min',

          branding: false,
          promotion: false,

          force_br_newlines : false,
          newline_behavior: 'linebreak',
          height: '90vh',
          menubar: true,
          toolbar_sticky: true,
          toolbar1: TinyOptions.toolbar1,
          toolbar2: TinyOptions.toolbar2,

          plugins: TinyOptions.plugins,

          codesample_languages: TinyOptions.codesample_languages,
          codesample_global_prismjs: true,
          text_patterns: TinyOptions.text_patterns,

          setup: (editor) => {
            editor.addShortcut('access+c', 'Open Codeblock', 'codesample');
            editor.ui.registry.addButton('submit', {
              text: 'Publish',
              tooltip: 'Publish',
              onAction: function () {
                document.getElementById('post-form').requestSubmit();
              },
            });
          },
          min_height: 650,
          autosave_interval: '1s',
          autosave_restore_when_empty: true,
          autosave_retention: '1440m',
          a11y_advanced_options: true,

          file_picker_types: 'file image media',
          automatic_uploads: true,
          images_upload_url: '/api/posts/upload',
          image_caption: true,
          image_advtab: true,
          image_uploadtab: true,

          file_picker_callback: TinyOptions.file_picker_callback,
          content_style: "body { font-family:Helvetica,Arial,sans-serif; font-size:14px; background-color: #fdfdfd;}",
        }}
      />
  </>;
}