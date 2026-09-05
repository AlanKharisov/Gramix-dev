import React from 'react';
import myImage from '../assets/image.png';

const styles = {
  ImageContainer: {
    top: '45px',
    left: '127px',
    width: '120px',
    height: '120px',
    borderRadius: '9999px',
    backgroundPosition: 'center center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  },
};

const Image = (props) => {
  return (
    <div
      style={{
        ...styles.ImageContainer,
        backgroundImage: `url(${props.image ?? myImage})`,
      }}
    />
  );
};

export default Image;