import NextImage from 'next/image'

const Image = ({
    src,
    alt,
    width = '150px',
    height = '8rem',
    children,
    ...props
}) => {
    return (
        <div style={{ position: 'relative', width: width, height: height }}>
            <NextImage
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw"
                style={{ objectFit: 'contain' }}
                priority
                {...props}
            />

            {children}
        </div>
    );
};

const showLoader = (show = true) => {
    const link = document.createElement("a");
    link.style.display = "none";
    link.style.position = "fixed";
    show && link.setAttribute("data-loader-link-start", "true");
    !show && link.setAttribute("data-loader-link-stop", "true");
    document.body.appendChild(link);
    link.click();
    link.remove();
}

const fetchRequest = async (...args) => {
    try {
        showLoader();
        const response = await fetch(args);
        showLoader(false);
        return response;
    } catch (error) {
        showLoader(false);
        throw error;
    }

}

function isValidLink(urlString) {
    const regex = /^(?:(https?|ftp|sftp):\/\/((localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))(:(\d+))?(\/[^\s]*)?)$|^(mailto:[^\s]+)$|^(tel:[+\d-]+)$/i;
    return regex.test(urlString);
}

export { Image, fetchRequest, isValidLink };