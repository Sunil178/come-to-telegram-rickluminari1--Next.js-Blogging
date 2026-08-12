'use client'
import { useEffect, useState } from "react";
import { Image } from '@/libs/helpers'
import styles from '@/styles/post-banner.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons'

export function BannerImage({ defaultImage }) {
    const emptyImage = '/assets/images/no-image.webp';
    const [imageURL, setImageURL] = useState(defaultImage ?? emptyImage);
    const [bannerLocation, setBannerLocation] = useState('');
    const [loader, setLoader] = useState('none');
    const [error, setError] = useState('');

    const uploadToServer = (event) => {
        if (event.target.files && event.target.files[0]) {
            const image = event.target.files[0];

            const body = new FormData();
            body.append("file", image);
            setLoader('block');
            setError('');
            fetch("/api/posts/upload", { method: "POST", body })
                .then((response) => response.json())
                .then((response) => {
                    if (!response.location) {
                        setError(response.message || 'Upload failed. Please try a different image.');
                        setLoader('none');
                        return;
                    }
                    setBannerLocation(response.location);
                    setImageURL(response.location);
                })
                .catch(() => {
                    setError('Upload failed. Please try again.');
                    setLoader('none');
                });
        }
    };

    const removeImage = (event) => {
        setImageURL(emptyImage);
        setBannerLocation('');
    }

    useEffect(() => {
        setLoader('none');
    }, [imageURL]);

    return (
        <>
            <div className={styles.bannerUpload}>
                <Image src={imageURL}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw" >

                    <FontAwesomeIcon className={styles.bannerLoader} style={{ display: loader }} icon={faSpinner} size="4x" color="#fab700" spin />

                    <div className={styles.bannerEditAndDelete}>
                        <div className={styles.bannerEdit}>
                            <input type="file" accept="image/*" id="postBanner" name="postBanner" onChange={uploadToServer} />
                            <input type="hidden" name="postBannerPath" value={bannerLocation} />
                            <label htmlFor="postBanner" className="postBannerLabel"><FontAwesomeIcon icon={faPencil} /></label>
                        </div>
                        <div className={styles.bannerDelete}>
                            <button className={styles.bannerDeleteBtn} type="button" onClick={removeImage}><FontAwesomeIcon icon={faXmark} /></button>
                        </div>
                    </div>

                </Image>
            </div>
            {error && <p className={styles.bannerError}>{error}</p>}
        </>
    );
}