import dbConnect from '@/libs/db-connect'
import Post from '@/models/Post'
import DOMPurify from 'dompurify'
const { JSDOM } = require('jsdom')
import styles from '@/styles/post.module.css'

export default async function Article(props) {
  const params = await props.params;
  const content = await fetchPost(params.slug);
  return (
      <div className={styles.container}>
        <div dangerouslySetInnerHTML={{__html: content}}></div>
      </div>
    )
}

export const fetchPost = async (slug) => {
  await dbConnect();
  const post = await Post.findOne({ slug }, [ 'content' ])
  const window = new JSDOM('').window
  const purify = DOMPurify(window)
  const sanitizedPost = purify.sanitize(post.content)
  return sanitizedPost;
}
