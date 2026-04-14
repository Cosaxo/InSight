import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
}

export default function StarRating({ rating, max = 5, size = 14 }: StarRatingProps) {
  return (
    <div className="star-rating">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < rating ? 'star filled' : 'star'}
          fill={i < rating ? '#f59e0b' : 'none'}
        />
      ))}
    </div>
  );
}
