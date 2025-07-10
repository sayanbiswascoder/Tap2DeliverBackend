"use client";
import React, { useState, useEffect, useCallback } from "react";
import { MdAdd, MdEdit, MdDelete } from "react-icons/md";
import { RiImageAddLine } from "react-icons/ri";
import { db } from "@/app/lib/firebase";
import { Client, Storage } from "appwrite";
import { collection, doc, getDoc, updateDoc } from "firebase/firestore";
import Cropper, { Area } from "react-easy-crop";
import ImageComponent  from "next/image";
import { useSearchParams } from "next/navigation"; // Import useSearchParams

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  restaurant?: string;
  isActive: boolean;
  createdAt: string;
}

// Appwrite configuration
const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('684c38d1000b0cf73531');

const storage = new Storage(client);
const BUCKET_ID = '684d0d8c002d88b96909';

const BannersPage = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [newBanner, setNewBanner] = useState<Partial<Banner>>({
    title: "",
    imageUrl: "",
    restaurant: "",
    isActive: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [showCropModal, setShowCropModal] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const searchParams = useSearchParams(); // Get search params

  // Fetch banners from Firebase
  const fetchBanners = async () => {
    try {
      const bannersDoc = await getDoc(doc(collection(db, "banners"), "banners"));
      if (bannersDoc.exists()) {
        const data = bannersDoc.data() as { banners: Banner[] };
        setBanners(data?.banners || []);
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // Effect to handle URL parameter for restaurantId
  useEffect(() => {
    const restaurantId = searchParams.get('restaurantId');
    if (restaurantId) {
      setNewBanner(prev => ({ ...prev, restaurant: restaurantId }));
      setShowAddModal(true);
    }
  }, [searchParams]); // Depend on searchParams to react to URL changes

  // Extract file ID from Appwrite URL
  const getFileIdFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/');
      const fileId = pathSegments[pathSegments.length - 1];
      return fileId;
    } catch (error) {
      console.error("Error parsing URL:", error);
      return null;
    }
  };

  // Delete file from Appwrite
  const deleteFileFromAppwrite = async (fileId: string) => {
    try {
      await storage.deleteFile(BUCKET_ID, fileId);
    } catch (error) {
      console.error("Error deleting file from Appwrite:", error);
      throw error;
    }
  };

  // Upload image to Appwrite
  const uploadImage = async (file: File): Promise<string> => {
    try {
      const upload = await storage.createFile(BUCKET_ID, `banner_${Date.now()}`, file);
      const fileUrl = storage.getFileView(BUCKET_ID, upload.$id);
      return fileUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Process selected file
  const processFile = (file: File) => {
    const maxSizeMB = 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      alert(`Image is too large. Max allowed size is ${maxSizeBytes}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;
      setSelectedFile(file);
      setImagePreview(e.target.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);
  };

  // Create cropped image
  const createCroppedImage = async (imageSrc: string, croppedAreaPixels: Area): Promise<File> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Could not get canvas context");
    }

    const { width, height, x, y } = croppedAreaPixels;
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        const file = new File([blob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });
        resolve(file);
      }, "image/jpeg", 0.95);
    });
  };

  // Handle crop complete
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Handle image upload
  const handleImageUpload = async () => {
    if (!selectedFile || !croppedAreaPixels || !imagePreview) return;

    setUploadingImage(true);
    try {
      const croppedFile = await createCroppedImage(imagePreview, croppedAreaPixels);
      const imageUrl = await uploadImage(croppedFile);
      return imageUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  // Update banners in Firebase
  const updateBannersInFirebase = async (newBanners: Banner[]) => {
    try {
      await updateDoc(doc(collection(db, "banners"), "banners"), {
        banners: newBanners
      });
    } catch (error) {
      console.error("Error updating banners:", error);
      throw error;
    }
  };

  // Add new banner
  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanner.title) return;

    try {
      const bannerToAdd: Banner = {
        id: Date.now().toString(),
        title: newBanner.title,
        imageUrl: (await handleImageUpload()) || '',
        restaurant: newBanner.restaurant,
        isActive: newBanner.isActive ?? true,
        createdAt: new Date().toISOString(),
      };

      const updatedBanners = [...banners, bannerToAdd];
      await updateBannersInFirebase(updatedBanners);
      setBanners(updatedBanners);
      setShowAddModal(false);
      setNewBanner({
        title: "",
        imageUrl: "",
        restaurant: "",
        isActive: true,
      });
      setSelectedFile(null);
      setImagePreview("");
      setShowCropModal(false);
    } catch (error) {
      console.error("Error adding banner:", error);
      alert("Failed to add banner");
    }
  };

  // Handle edit banner form submission
  const handleEditBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    try {
      let updatedBanner = { ...editingBanner };
      let oldFileId: string | null = null;

      if (selectedFile && croppedAreaPixels) {
        oldFileId = getFileIdFromUrl(editingBanner.imageUrl);
        const newImageUrl = await handleImageUpload();
        if (newImageUrl) {
          updatedBanner = { ...updatedBanner, imageUrl: newImageUrl };
        }
      }

      const updatedBanners = banners.map(banner =>
        banner.id === editingBanner.id ? updatedBanner : banner
      );
      await updateBannersInFirebase(updatedBanners);

      if (oldFileId) {
        await deleteFileFromAppwrite(oldFileId);
      }

      setBanners(updatedBanners);
      setEditingBanner(null);
      setSelectedFile(null);
      setImagePreview("");
      setShowCropModal(false);
    } catch (error) {
      console.error("Error updating banner:", error);
      alert("Failed to update banner");
    }
  };

  // Toggle banner active status
  const handleToggleActive = async (bannerId: string) => {
    try {
      const updatedBanners = banners.map(banner =>
        banner.id === bannerId ? { ...banner, isActive: !banner.isActive } : banner
      );
      await updateBannersInFirebase(updatedBanners);
      setBanners(updatedBanners);
    } catch (error) {
      console.error("Error toggling banner status:", error);
      alert("Failed to update banner status");
    }
  };

  // Delete banner
  const handleDelete = async (bannerId: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const bannerToDelete = banners.find(banner => banner.id === bannerId);
      if (bannerToDelete) {
        const fileId = getFileIdFromUrl(bannerToDelete.imageUrl);
        if (fileId) {
          await deleteFileFromAppwrite(fileId);
        }
      }

      const updatedBanners = banners.filter(banner => banner.id !== bannerId);
      await updateBannersInFirebase(updatedBanners);
      setBanners(updatedBanners);
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Failed to delete banner");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Banners</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <MdAdd size={20} />
          Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map((banner) => (
          <div
            key={banner.id}
            className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
          >
            <div className="relative">
              <ImageComponent
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-48 object-cover"
                width={400}
                height={192}
              />
              <div className="absolute top-2 right-2">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    banner.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {banner.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">{banner.title}</h3>
              <p className="text-sm text-gray-600 mb-3">
                Created: {new Date(banner.createdAt).toLocaleDateString()}
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(banner.id)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    banner.isActive
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-green-100 text-green-700 hover:bg-green-200"
                  }`}
                >
                  {banner.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    setEditingBanner(banner);
                    setImagePreview(banner.imageUrl);
                  }}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <MdEdit size={16} />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
                >
                  <MdDelete size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <MdEdit className="m-auto" size={64} />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No banners yet</h3>
          <p className="text-gray-500 mb-4">Create your first banner to get started</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition66colors"
          >
            Add Banner
          </button>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-h-[90%] max-w-md mx-4 overflow-scroll">
            <h2 className="text-xl font-bold mb-4">Add New Banner</h2>
            <form onSubmit={handleAddBanner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newBanner.title}
                  onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image Upload
                </label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleFileSelect({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
                    }
                  }}
                >
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="text-gray-400">
                        <RiImageAddLine className="mx-auto" size={24} />
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600 hover:text-blue-500">
                          Click to upload
                        </span>{' '}
                        or drag and drop
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </label>
                </div>
                {imagePreview && !showCropModal && (
                  <div className="mt-2">
                    <ImageComponent src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant ID (optional)
                </label>
                <input
                  type="text"
                  value={newBanner.restaurant}
                  onChange={(e) => setNewBanner({ ...newBanner, restaurant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={newBanner.isActive}
                  onChange={(e) => setNewBanner({ ...newBanner, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewBanner({ // Reset newBanner state when cancelling
                      title: "",
                      imageUrl: "",
                      restaurant: "",
                      isActive: true,
                    });
                    setSelectedFile(null);
                    setImagePreview("");
                    setShowCropModal(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={uploadingImage || showCropModal}
                >
                  {uploadingImage ? "Uploading..." : "Add Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingBanner && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-h-[90%] max-w-md mx-4 overflow-scroll">
            <h2 className="text-xl font-bold mb-4">Edit Banner</h2>
            <form onSubmit={handleEditBanner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingBanner.title}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image Upload
                </label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      handleFileSelect({ target: { files } } as React.ChangeEvent<HTMLInputElement>);
                    }
                  }}
                >
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="image-upload-edit"
                  />
                  <label htmlFor="image-upload-edit" className="cursor-pointer">
                    <div className="space-y-2">
                      <div className="text-gray-400">
                        <RiImageAddLine  className="mx-auto" size={24} />
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600 hover:text-blue-500">
                          Click to upload
                        </span>{' '}
                        or drag and drop
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </label>
                </div>
                {imagePreview && !showCropModal && (
                  <div className="mt-2">
                    <ImageComponent src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link URL (optional)
                </label>
                <input
                  type="text"
                  value={editingBanner.restaurant || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, restaurant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editingBanner.isActive}
                  onChange={(e) => setEditingBanner({ ...editingBanner, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="editIsActive" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBanner(null);
                    setSelectedFile(null);
                    setImagePreview("");
                    setShowCropModal(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={uploadingImage || showCropModal}
                >
                  {uploadingImage ? "Uploading..." : "Save Banner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && imagePreview && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Crop Image</h2>
            <div className="relative w-full h-64">
              <Cropper
                image={imagePreview}
                crop={crop}
                zoom={zoom}
                aspect={2.25}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition={false}
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zoom
              </label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setSelectedFile(null);
                  setImagePreview("");
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Crop Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannersPage;