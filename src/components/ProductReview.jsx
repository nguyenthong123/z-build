import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import './ProductReview.css';
import { useToast } from '../context/ToastContext';

const ProductReview = ({ productId, isLoggedIn, onLoginRequired }) => {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useToast();
  const currentUser = auth.currentUser;

  useEffect(() => {
    // Debug log
    console.log("ProductReview - Product ID:", productId);
    
    if (!productId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const pId = String(productId).trim();
    
    // We use a simple query first to ensure it works even without complex indexes
    // and we'll sort manually in JS
    const q = query(
      collection(db, "reviews"),
      where("productId", "==", pId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      try {
        const reviewData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Fallback for fields if missing
            userName: data.userName || "Người dùng",
            comment: data.comment || "",
            rating: Number(data.rating) || 5,
            createdAt: data.createdAt
          };
        });

        // Manual sort by date descending
        reviewData.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        console.log("ProductReview - Fetched reviews count:", reviewData.length);
        setReviews(reviewData);
        setLoading(false);
      } catch (err) {
        console.error("Error processing reviews data:", err);
        setError("Lỗi xử lý dữ liệu");
        setLoading(false);
      }
    }, (err) => {
      console.error("Error fetching reviews from Firestore:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        addToast("Bạn cần đăng nhập để xem đầy đủ đánh giá.", "warning");
      }
    });

    return () => unsubscribe();
  }, [productId, isLoggedIn, addToast]); // Add addToast to dependencies

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    if (!comment.trim()) {
      addToast("Vui lòng nhập nội dung đánh giá!", "error");
      return;
    }

    setSubmitting(true);
    try {
      const userData = auth.currentUser;
      const pId = String(productId).trim();
      
      const newReview = {
        productId: pId,
        userId: userData.uid,
        userName: userData.displayName || userData.email.split('@')[0],
        userPhoto: userData.photoURL || null,
        rating: Number(rating),
        comment: comment.trim(),
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "reviews"), newReview);
      setComment('');
      setRating(5);
      addToast("Đã gửi đánh giá của bạn!", "success");
    } catch (error) {
      console.error("Error adding review:", error);
      addToast("Không thể gửi đánh giá. Vui lòng thử lại.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    if (!window.confirm("Bạn có muốn xoá vĩnh viễn đánh giá này không?")) return;
    
    try {
      await deleteDoc(doc(db, "reviews", reviewId));
      addToast("Đã xoá đánh giá thành công", "info");
    } catch (error) {
      console.error("Error deleting review:", error);
      addToast("Lỗi khi xoá đánh giá", "error");
    }
  };

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + (Number(curr.rating) || 0), 0) / reviews.length).toFixed(1)
    : 0;

  const renderStars = (count, isInteractive = false) => {
    const starCount = Math.round(Number(count)) || 0;
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      const isFilled = isInteractive ? (hoverRating || rating) >= starValue : starCount >= starValue;
      
      return (
        <span 
          key={i} 
          className={`star-icon ${isFilled ? 'filled' : ''} ${isInteractive ? 'interactive' : ''}`}
          onClick={isInteractive ? () => setRating(starValue) : undefined}
          onMouseEnter={isInteractive ? () => setHoverRating(starValue) : undefined}
          onMouseLeave={isInteractive ? () => setHoverRating(0) : undefined}
          style={{ 
            cursor: isInteractive ? 'pointer' : 'default',
            marginRight: '3px',
            display: 'inline-flex'
          }}
        >
          <svg 
            width={isInteractive ? "24" : "18"} 
            height={isInteractive ? "24" : "18"} 
            viewBox="0 0 24 24" 
            fill={isFilled ? "#FFB800" : "none"} 
            stroke={isFilled ? "#FFB800" : "#d1d1d1"} 
            strokeWidth="2" 
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </span>
      );
    });
  };

  return (
    <div className="reviews-section" id="reviews" style={{ padding: '60px 0', borderTop: '1px solid #efefef', maxWidth: '100%' }}>
      {/* Summary Header */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '20px', color: '#1a1a1a' }}>Đánh giá & Nhận xét</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#fff9e6', padding: '15px 25px', borderRadius: '16px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: '900', color: '#FFB800' }}>{averageRating}</span>
            <div>
              <div style={{ display: 'flex', marginBottom: '4px' }}>{renderStars(averageRating)}</div>
              <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>{reviews.length} đánh giá khách hàng</span>
            </div>
          </div>
        </div>
      </div>

      {/* Write Review Card */}
      <div className="review-form-container" style={{ background: '#f8f9fa', padding: '35px', borderRadius: '24px', marginBottom: '50px', border: '1px solid #eee', position: 'relative' }}>
        {!isLoggedIn && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px', backdropFilter: 'blur(4px)' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: '700', marginBottom: '15px', fontSize: '1.1rem' }}>Vui lòng đăng nhập để gửi đánh giá</p>
              <button 
                onClick={onLoginRequired}
                style={{ background: '#1a1a1a', color: 'white', padding: '12px 30px', borderRadius: '12px', border: 'none', fontWeight: '700', cursor: 'pointer' }}
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        )}

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>Chia sẻ trải nghiệm của bạn</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '25px' }}>
            <p style={{ marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>Mức độ hài lòng của bạn?</p>
            <div style={{ display: 'flex' }}>
              {renderStars(rating, true)}
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <textarea 
              placeholder="Sản phẩm này tuyệt vời như thế nào? (Nội dung đánh giá...)" 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              style={{ width: '100%', minHeight: '140px', padding: '20px', borderRadius: '16px', border: '1px solid #ddd', fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s' }}
            ></textarea>
          </div>
          <button 
            type="submit" 
            disabled={submitting || !isLoggedIn}
            style={{ 
              padding: '16px 45px', 
              borderRadius: '14px', 
              background: '#1a1a1a', 
              color: 'white', 
              border: 'none', 
              fontWeight: '700', 
              cursor: (submitting || !isLoggedIn) ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {submitting ? 'Đang gửi...' : 'Gửi đánh giá ngay'}
          </button>
        </form>
      </div>

      {/* Reviews List */}
      <div className="reviews-list">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#666' }}>Đang tải các đánh giá...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px', background: '#fff0f0', borderRadius: '16px', color: '#ff4d4f' }}>
            <p>{error}</p>
          </div>
        ) : reviews.length > 0 ? (
          reviews.map(review => (
            <div key={review.id} className="review-item" style={{ padding: '30px', background: 'white', borderRadius: '24px', border: '1px solid #f0f0f0', marginBottom: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: '#f5f5f5', border: '2px solid #fff' }}>
                    {review.userPhoto ? (
                      <img src={review.userPhoto} alt={review.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: 'white', fontWeight: '800', fontSize: '1.4rem' }}>
                        {review.userName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', fontWeight: '700', color: '#1a1a1a' }}>{review.userName}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>
                      Đã đánh giá vào: {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'}
                    </p>
                  </div>
                </div>

                {currentUser && currentUser.uid === review.userId && (
                  <button 
                    onClick={() => handleDelete(review.id)}
                    style={{ background: '#fff0f0', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', color: '#ff4d4f', transition: 'all 0.2s' }}
                    title="Xoá đánh giá của bạn"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                  </button>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                {renderStars(review.rating)}
              </div>

              <p style={{ color: '#444', lineHeight: '1.7', fontSize: '1.05rem', margin: 0, whiteSpace: 'pre-wrap' }}>
                {review.comment}
              </p>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fafafa', borderRadius: '24px', border: '2px dashed #eee' }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.2 }}>💬</div>
            <h3 style={{ fontSize: '1.2rem', color: '#666', fontWeight: '700', marginBottom: '10px' }}>Chưa có đánh giá nào</h3>
            <p style={{ color: '#999' }}>Hãy là người đầu tiên nhận xét về sản phẩm này!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductReview;
