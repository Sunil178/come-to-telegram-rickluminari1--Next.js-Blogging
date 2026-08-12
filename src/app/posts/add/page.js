'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TinyMCEEditor } from '@/components/tinymce'
import { PostTag } from '@/components/post-tags'
import { BannerImage } from '@/components/post-banner'
import { slugify } from '@/libs/slug'
import styles from '@/styles/post.module.css'

export default function AddPost({ content }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  const handleTitleChange = (event) => {
    if (!slugEdited) {
      setSlug(slugify(event.target.value))
    }
  }

  const handleSlugChange = (event) => {
    setSlugEdited(true)
    setSlug(event.target.value)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        body: new FormData(event.currentTarget),
      })

      if (response.status === 401) {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent('/posts/add')}`)
        return
      }

      const result = await response.json()
      if (!response.ok) {
        setError(result.message || 'Something went wrong. Please try again.')
        return
      }

      router.push('/dashboard/posts')
      router.refresh()
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <>
      <form id="post-form" className={styles.postForm} onSubmit={handleSubmit}>
        {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}
        {submitting && <div style={{ marginBottom: '1rem' }}>Publishing…</div>}
        <div className='editor'>
          <div className={styles.cardContainer}>
            <div className={styles.card}>

              <h2 className={styles.head}>Banner</h2>
              <BannerImage defaultImage={null} />

              <h2 className={styles.head}>Title</h2>
              <label className={styles.input}>
                <textarea className={`${styles.textarea} ${styles.inputField}`} type="text" name='title' placeholder=" " onChange={handleTitleChange} required></textarea>
                <span className={styles.inputLabel}>Title...</span>
              </label>

              <h2 className={styles.head}>Title Description</h2>
              <label className={styles.input}>
                <textarea className={`${styles.textarea} ${styles.inputField}`} type="text" name='titleDescription' placeholder=" " ></textarea>
                <span className={styles.inputLabel}>Title Description...</span>
              </label>

              <h2 className={styles.head}>URL Slug</h2>
              <label className={styles.input}>
                <input className={styles.inputField} type="text" name='slug' placeholder=" " value={slug} onChange={handleSlugChange} required />
                <span className={styles.inputLabel}>Slug...</span>
              </label>

              <h2 className={styles.head}>Tags</h2>
              <PostTag />

            </div>
          </div>
        </div>

        <div className='editor'>
          <div className={`${styles.cardEditor}`}>
            <TinyMCEEditor content={content} />
          </div>
        </div>
      </form>
    </>
}
